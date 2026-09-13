import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { MemoryRecord, ExtractedMemory } from './types';

export class MemoryDatabase {
  private db: Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor(dbFileName = 'somya_memory.db') {
    this.dbPath = path.join(process.cwd(), dbFileName);
  }

  public async initialize(): Promise<boolean> {
    try {
      const SQL = await initSqlJs();

      // Check if persistent binary SQLite file exists on disk
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
        console.log(`[MEMORY] Loaded existing persistent database from ${this.dbPath} (${fileBuffer.length} bytes)`);
      } else {
        this.db = new SQL.Database();
        console.log(`[MEMORY] Creating new persistent database at ${this.dbPath}`);
      }

      this.createSchema();
      this.migrateLegacyJsonIfNeeded();
      this.persistToDisk();

      this.isInitialized = true;
      console.log('[MEMORY] Database initialized successfully (SQLite via sql.js)');
      return true;
    } catch (error) {
      console.error('[MEMORY] Database error during initialization:', error);
      // Fallback: create fresh in-memory database so system never crashes
      try {
        const SQL = await initSqlJs();
        this.db = new SQL.Database();
        this.createSchema();
        this.isInitialized = true;
        console.warn('[MEMORY] Database running in degraded in-memory mode due to init warning');
        return true;
      } catch (fallbackErr) {
        console.error('[MEMORY] Critical: Failed to create fallback database:', fallbackErr);
        this.isInitialized = false;
        return false;
      }
    }
  }

  private createSchema(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        importance TEXT NOT NULL,
        confidence REAL NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        content TEXT NOT NULL
      );
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(active);`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Standardize any legacy user_name keys to canonical 'name'
    try {
      this.db.run(`UPDATE memories SET key = 'name' WHERE key = 'user_name';`);
    } catch (e) {
      // Ignore if column already clean
    }
  }

  private migrateLegacyJsonIfNeeded(): void {
    if (!this.db) return;

    const legacyFile = path.join(process.cwd(), 'somya_memories.json');
    if (fs.existsSync(legacyFile)) {
      try {
        const countRes = this.db.exec(`SELECT COUNT(*) as count FROM memories WHERE active = 1;`);
        const existingCount = (countRes[0]?.values[0]?.[0] as number) || 0;

        if (existingCount === 0) {
          const raw = fs.readFileSync(legacyFile, 'utf-8');
          const legacyRecords: Array<{
            id?: string;
            content?: string;
            category?: string;
            importance?: number;
            createdAt?: string;
          }> = JSON.parse(raw);

          if (Array.isArray(legacyRecords) && legacyRecords.length > 0) {
            for (const item of legacyRecords) {
              if (item.content) {
                const now = item.createdAt || new Date().toISOString();
                const key = this.generateKeyFromText(item.content);
                const category = this.normalizeCategory(item.category);
                const id = item.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

                this.db.run(
                  `INSERT INTO memories (id, category, key, value, importance, confidence, created_at, updated_at, last_accessed_at, access_count, source, active, content)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    id,
                    category,
                    key,
                    item.content,
                    'MEDIUM',
                    0.9,
                    now,
                    now,
                    now,
                    1,
                    'SYSTEM',
                    1,
                    item.content,
                  ]
                );
              }
            }
            console.log(`[MEMORY] Migrated ${legacyRecords.length} records from legacy json store`);
          }
        }
      } catch (err) {
        console.warn('[MEMORY] Notice: legacy migration skipped or failed:', err);
      }
    }
  }

  public persistToDisk(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error('[MEMORY] Database error writing to disk:', error);
    }
  }

  public saveOrUpdate(extracted: ExtractedMemory): MemoryRecord {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database is not initialized');
    }

    const now = new Date().toISOString();
    const normalizedKey = extracted.key.toLowerCase().trim();
    // Canonical key: 'name' is standard for user name
    const canonicalKey = normalizedKey === 'user_name' || normalizedKey === 'name' ? 'name' : normalizedKey;

    // Check if an existing memory with this key exists (prefer active records first)
    const isNameKey = canonicalKey === 'name';
    const stmt = isNameKey
      ? this.db.prepare(
          `SELECT * FROM memories WHERE (key = 'name' OR key = 'user_name') ORDER BY active DESC, updated_at DESC LIMIT 1;`
        )
      : this.db.prepare(
          `SELECT * FROM memories WHERE key = ? ORDER BY active DESC, updated_at DESC LIMIT 1;`
        );
    if (!isNameKey) {
      stmt.bind([canonicalKey]);
    }

    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as MemoryRecord;
      stmt.free();

      // Check if value is identical and record is already active
      const isSameValue = row.value.trim().toLowerCase() === extracted.value.trim().toLowerCase();

      if (isSameValue && row.active === 1) {
        // Just refresh access & confidence without creating duplicate
        this.db.run(
          `UPDATE memories SET
            last_accessed_at = ?,
            access_count = access_count + 1,
            confidence = MAX(confidence, ?),
            updated_at = ?,
            key = ?
           WHERE id = ?;`,
          [now, extracted.confidence, now, canonicalKey, row.id]
        );
        this.persistToDisk();
        console.log(`[MEMORY] Memory confirmed & refreshed (no duplicate): [${canonicalKey}]`);
        return this.getById(row.id)!;
      } else {
        // Value has been updated or reactivated (e.g. favorite_game changed from GTA to Minecraft)
        const updatedContent = this.formatDisplayContent(canonicalKey, extracted.value, extracted.category);
        this.db.run(
          `UPDATE memories SET
            key = ?,
            value = ?,
            content = ?,
            category = ?,
            importance = ?,
            confidence = ?,
            updated_at = ?,
            last_accessed_at = ?,
            access_count = access_count + 1,
            active = 1
           WHERE id = ?;`,
          [
            canonicalKey,
            extracted.value,
            updatedContent,
            extracted.category,
            extracted.importance,
            extracted.confidence,
            now,
            now,
            row.id,
          ]
        );
        this.persistToDisk();
        console.log(`[MEMORY] Memory updated: [${canonicalKey} = ${extracted.value}]`);
        return this.getById(row.id)!;
      }
    } else {
      stmt.free();

      // Insert new record
      const id = `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const displayContent = this.formatDisplayContent(canonicalKey, extracted.value, extracted.category);

      this.db.run(
        `INSERT INTO memories (id, category, key, value, importance, confidence, created_at, updated_at, last_accessed_at, access_count, source, active, content)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          extracted.category,
          canonicalKey,
          extracted.value,
          extracted.importance,
          extracted.confidence,
          now,
          now,
          now,
          1,
          extracted.source,
          1,
          displayContent,
        ]
      );

      this.persistToDisk();
      console.log(`[MEMORY] Memory saved: [${canonicalKey} = ${extracted.value}]`);
      return this.getById(id)!;
    }
  }

  public getById(id: string): MemoryRecord | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`SELECT * FROM memories WHERE id = ? LIMIT 1;`);
      stmt.bind([id]);
      if (stmt.step()) {
        const obj = stmt.getAsObject() as unknown as MemoryRecord;
        stmt.free();
        return obj;
      }
      stmt.free();
      return null;
    } catch (err) {
      console.error('[MEMORY] Database error in getById:', err);
      return null;
    }
  }

  public findActiveByKey(key: string): MemoryRecord | null {
    if (!this.db) return null;
    try {
      const normalizedKey = key.toLowerCase().trim();
      const isNameKey = normalizedKey === 'name' || normalizedKey === 'user_name';
      const stmt = isNameKey
        ? this.db.prepare(
            `SELECT * FROM memories WHERE (key = 'name' OR key = 'user_name') AND active = 1 ORDER BY updated_at DESC LIMIT 1;`
          )
        : this.db.prepare(`SELECT * FROM memories WHERE key = ? AND active = 1 LIMIT 1;`);
      if (!isNameKey) {
        stmt.bind([normalizedKey]);
      }
      if (stmt.step()) {
        const obj = stmt.getAsObject() as unknown as MemoryRecord;
        stmt.free();
        return obj;
      }
      stmt.free();
      return null;
    } catch (err) {
      console.error('[MEMORY] Database error in findActiveByKey:', err);
      return null;
    }
  }

  public getAllActive(): MemoryRecord[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(
        `SELECT * FROM memories WHERE active = 1 ORDER BY updated_at DESC;`
      );
      const list: MemoryRecord[] = [];
      while (stmt.step()) {
        list.push(stmt.getAsObject() as unknown as MemoryRecord);
      }
      stmt.free();
      return list;
    } catch (err) {
      console.error('[MEMORY] Database error in getAllActive:', err);
      return [];
    }
  }

  public deleteById(id: string): boolean {
    if (!this.db) return false;
    try {
      this.db.run(`UPDATE memories SET active = 0 WHERE id = ?;`, [id]);
      this.persistToDisk();
      console.log(`[MEMORY] Memory deleted by ID: ${id}`);
      return true;
    } catch (err) {
      console.error('[MEMORY] Database error in deleteById:', err);
      return false;
    }
  }

  public deleteByKey(key: string): boolean {
    if (!this.db) return false;
    try {
      const normalizedKey = key.toLowerCase().trim();
      const isNameKey = normalizedKey === 'name' || normalizedKey === 'user_name';
      if (isNameKey) {
        this.db.run(`UPDATE memories SET active = 0 WHERE key = 'name' OR key = 'user_name';`);
      } else {
        this.db.run(
          `UPDATE memories SET active = 0 WHERE key = ? OR key LIKE ?;`,
          [normalizedKey, `%${normalizedKey}%`]
        );
      }
      this.persistToDisk();
      console.log(`[MEMORY] Memory deleted by key: ${normalizedKey}`);
      return true;
    } catch (err) {
      console.error('[MEMORY] Database error in deleteByKey:', err);
      return false;
    }
  }

  public clearAll(): boolean {
    if (!this.db) return false;
    try {
      this.db.run(`UPDATE memories SET active = 0;`);
      this.persistToDisk();
      console.log('[MEMORY] All memories cleared');
      return true;
    } catch (err) {
      console.error('[MEMORY] Database error in clearAll:', err);
      return false;
    }
  }

  public touchAccess(id: string): void {
    if (!this.db) return;
    try {
      const now = new Date().toISOString();
      this.db.run(
        `UPDATE memories SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?;`,
        [now, id]
      );
      // Soft persist in background
      this.persistToDisk();
    } catch (err) {
      console.error('[MEMORY] Database error in touchAccess:', err);
    }
  }

  public getSystemSetting(key: string): string | null {
    if (!this.db || !this.isInitialized) return null;
    try {
      const stmt = this.db.prepare(`SELECT value FROM system_settings WHERE key = ? LIMIT 1;`);
      stmt.bind([key]);
      if (stmt.step()) {
        const row = stmt.getAsObject() as { value: string };
        stmt.free();
        return row.value;
      }
      stmt.free();
      return null;
    } catch (e) {
      console.error('[MEMORY] Database error reading system setting:', e);
      return null;
    }
  }

  public getAllSystemSettings(): Record<string, string> {
    if (!this.db || !this.isInitialized) return {};
    try {
      const res = this.db.exec(`SELECT key, value FROM system_settings;`);
      const result: Record<string, string> = {};
      if (res && res[0] && res[0].values) {
        for (const row of res[0].values) {
          result[String(row[0])] = String(row[1]);
        }
      }
      return result;
    } catch (e) {
      console.error('[MEMORY] Database error reading all system settings:', e);
      return {};
    }
  }

  public setSystemSetting(key: string, value: string): boolean {
    if (!this.db || !this.isInitialized) return false;
    try {
      const now = new Date().toISOString();
      const existing = this.getSystemSetting(key);
      if (existing !== null) {
        this.db.run(`UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?;`, [value, now, key]);
      } else {
        this.db.run(`INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?);`, [key, value, now]);
      }
      this.persistToDisk();
      console.log(`[SETTINGS] System setting persisted: [${key} = ${value.slice(0, 40)}]`);
      return true;
    } catch (e) {
      console.error('[MEMORY] Database error setting system setting:', e);
      return false;
    }
  }

  private generateKeyFromText(text: string): string {
    const clean = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 4)
      .join('_');
    return clean || 'general_note';
  }

  private normalizeCategory(cat?: string): MemoryRecord['category'] {
    const c = (cat || '').toUpperCase();
    if (
      [
        'PROFILE',
        'PREFERENCE',
        'INTEREST',
        'PROJECT',
        'GOAL',
        'HABIT',
        'CONVERSATION_FACT',
        'IMPORTANT_FACT',
        'USER_SETTING',
      ].includes(c)
    ) {
      return c as MemoryRecord['category'];
    }
    if (c === 'PERSONAL') return 'PROFILE';
    if (c === 'TASK') return 'GOAL';
    return 'PREFERENCE';
  }

  private formatDisplayContent(key: string, value: string, category: string): string {
    const readableKey = key.replace(/_/g, ' ');
    return `${readableKey}: ${value}`;
  }
}
