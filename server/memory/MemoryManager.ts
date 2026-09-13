import { MemoryDatabase } from './MemoryDatabase';
import { MemoryExtractor } from './MemoryExtractor';
import { MemoryRetriever } from './MemoryRetriever';
import { MemoryContextBuilder } from './MemoryContextBuilder';
import { MemoryRecord, ExtractedMemory, MemoryCategory, MemoryImportance } from './types';

export interface ProcessedMemoryResult {
  memoryContext: string;
  memorySaved?: MemoryRecord;
  actionTaken?: 'SAVED' | 'UPDATED' | 'DELETED' | 'CLEARED' | 'NONE';
  explicitReply?: string;
  retrievedCount: number;
}

export class MemoryManager {
  private database: MemoryDatabase;
  private extractor: MemoryExtractor;
  private retriever: MemoryRetriever;
  private contextBuilder: MemoryContextBuilder;
  private isReady = false;

  constructor() {
    this.database = new MemoryDatabase('somya_memory.db');
    this.extractor = new MemoryExtractor();
    this.retriever = new MemoryRetriever();
    this.contextBuilder = new MemoryContextBuilder();
  }

  public async initialize(): Promise<boolean> {
    try {
      this.isReady = await this.database.initialize();
      return this.isReady;
    } catch (error) {
      console.error('[MEMORY] Database error during manager initialization:', error);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Central entry point called by the chat pipeline before querying Gemini.
   */
  public async processConversationTurn(
    userQuery: string,
    memoryEnabled: boolean
  ): Promise<ProcessedMemoryResult> {
    if (!this.isReady) {
      await this.initialize();
    }

    if (!memoryEnabled || !this.isReady) {
      return {
        memoryContext: '',
        actionTaken: 'NONE',
        retrievedCount: 0,
      };
    }

    try {
      // 1. Analyze user message for explicit commands or automatic memory opportunities
      const intent = this.extractor.parseMemoryIntent(userQuery);

      // Handle Clear All command
      if (intent.type === 'CLEAR_ALL') {
        this.database.clearAll();
        return {
          memoryContext: '',
          actionTaken: 'CLEARED',
          explicitReply: 'Maine aapki saari stored memories clear kar di hain. Memory bank ab fresh hai.',
          retrievedCount: 0,
        };
      }

      // Handle Delete Specific Memory command
      if (intent.type === 'DELETE_KEY' && intent.targetKey) {
        const deleted = this.database.deleteByKey(intent.targetKey);
        const readable = intent.targetKey.replace(/_/g, ' ');
        return {
          memoryContext: '',
          actionTaken: 'DELETED',
          explicitReply: deleted
            ? `Thik hai, maine "${readable}" se judi memory ko remove kar diya hai.`
            : `Mujhe "${readable}" se related koi memory nahi mili jise delete kiya ja sake.`,
          retrievedCount: 0,
        };
      }

      // Handle Explicit or Automatic Save
      let memorySaved: MemoryRecord | undefined = undefined;
      let actionTaken: ProcessedMemoryResult['actionTaken'] = 'NONE';

      if (intent.type === 'SAVE' && intent.extractedMemory) {
        // Save or update in database BEFORE confirming
        const beforeCheck = this.database.findActiveByKey(intent.extractedMemory.key);
        memorySaved = this.database.saveOrUpdate(intent.extractedMemory);

        if (beforeCheck && beforeCheck.value !== intent.extractedMemory.value) {
          actionTaken = 'UPDATED';
        } else {
          actionTaken = 'SAVED';
        }
      }

      // 2. Retrieve relevant memories for the current query
      const allActive = this.database.getAllActive();
      const relevant = this.retriever.retrieveRelevant(userQuery, allActive);

      // If a memory was just saved or updated in this turn, ensure it is included
      if (memorySaved && !relevant.some((m) => m.id === memorySaved!.id)) {
        relevant.unshift(memorySaved);
      }

      // Update access stats on retrieved memories
      for (const mem of relevant) {
        this.database.touchAccess(mem.id);
      }

      // 3. Build context for Gemini
      const memoryContext = this.contextBuilder.buildContext(relevant);

      return {
        memoryContext,
        memorySaved,
        actionTaken,
        retrievedCount: relevant.length,
      };
    } catch (error) {
      console.error('[MEMORY] Database error in processConversationTurn:', error);
      return {
        memoryContext: '',
        actionTaken: 'NONE',
        retrievedCount: 0,
      };
    }
  }

  // --- CRUD Operations for UI and API endpoints ---

  public getAllMemories(): MemoryRecord[] {
    try {
      return this.database.getAllActive();
    } catch (error) {
      console.error('[MEMORY] Database error in getAllMemories:', error);
      return [];
    }
  }

  public addMemory(
    content: string,
    category: MemoryCategory = 'PREFERENCE',
    importance: MemoryImportance = 'MEDIUM'
  ): MemoryRecord | null {
    try {
      const extracted: ExtractedMemory = {
        category,
        key: this.extractor.normalizeKeyFromPhrase(content),
        value: content,
        importance,
        confidence: 1.0,
        source: 'UI',
      };
      return this.database.saveOrUpdate(extracted);
    } catch (error) {
      console.error('[MEMORY] Database error in addMemory:', error);
      return null;
    }
  }

  public deleteMemory(id: string): boolean {
    try {
      return this.database.deleteById(id);
    } catch (error) {
      console.error('[MEMORY] Database error in deleteMemory:', error);
      return false;
    }
  }

  public clearAllMemories(): boolean {
    try {
      return this.database.clearAll();
    } catch (error) {
      console.error('[MEMORY] Database error in clearAllMemories:', error);
      return false;
    }
  }

  public getMemoryCount(): number {
    try {
      return this.database.getAllActive().length;
    } catch {
      return 0;
    }
  }

  public getSystemSetting(key: string): string | null {
    return this.database.getSystemSetting(key);
  }

  public getAllSystemSettings(): Record<string, string> {
    return this.database.getAllSystemSettings();
  }

  public setSystemSetting(key: string, value: string): boolean {
    return this.database.setSystemSetting(key, value);
  }
}

// Global Singleton for the server instance
export const memoryManager = new MemoryManager();
