export type MemoryCategory =
  | 'PROFILE'
  | 'PREFERENCE'
  | 'INTEREST'
  | 'PROJECT'
  | 'GOAL'
  | 'HABIT'
  | 'CONVERSATION_FACT'
  | 'IMPORTANT_FACT'
  | 'USER_SETTING';

export type MemoryImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type MemorySource = 'EXPLICIT' | 'AUTOMATIC' | 'UI' | 'SYSTEM';

export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  importance: MemoryImportance;
  confidence: number;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  access_count: number;
  source: MemorySource;
  active: number; // 1 = active, 0 = soft deleted
  content: string; // Natural language display string
}

export interface ExtractedMemory {
  category: MemoryCategory;
  key: string;
  value: string;
  importance: MemoryImportance;
  confidence: number;
  source: MemorySource;
}

export interface MemoryRetrievalResult {
  memories: MemoryRecord[];
  contextString: string;
  matchedCount: number;
}

export interface MemoryIntent {
  type: 'SAVE' | 'RETRIEVE_ALL' | 'DELETE_KEY' | 'CLEAR_ALL' | 'NORMAL';
  targetKey?: string;
  extractedMemory?: ExtractedMemory;
  queryTopic?: string;
}
