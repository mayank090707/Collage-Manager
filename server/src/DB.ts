import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'db.json');
const BAK_PATH = path.join(__dirname, '..', 'db.json.bak');
const TMP_PATH = path.join(__dirname, '..', 'db.json.tmp');

export interface DBTemplate {
  users: any[];
  userData: any[];
}

const INITIAL_DATA: DBTemplate = {
  users: [],
  userData: []
};

function isValidDBStructure(data: any): data is DBTemplate {
  return (
    data !== null &&
    typeof data === 'object' &&
    Array.isArray(data.users) &&
    Array.isArray(data.userData)
  );
}

class FileDB {
  private data: DBTemplate;
  private writeQueue: Promise<any> = Promise.resolve();

  constructor() {
    this.data = this.load();
  }

  /**
   * CRITICAL SAFETY REQUIREMENT:
   * Load database safely with fallback to db.json.bak.
   * If both db.json and db.json.bak exist but are invalid/corrupt,
   * DO NOT create INITIAL_DATA and DO NOT overwrite either file.
   * Log a CRITICAL recovery error and exit process safely to protect disk data.
   */
  private load(): DBTemplate {
    const dbExists = fs.existsSync(DB_PATH);
    const bakExists = fs.existsSync(BAK_PATH);

    // 1. Try reading primary db.json
    if (dbExists) {
      try {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        if (isValidDBStructure(parsed)) {
          // Keep backup synced with valid DB
          try {
            fs.writeFileSync(BAK_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
          } catch (e) {
            console.error('Failed to update backup file:', e);
          }
          console.log('[DB LOAD] Successfully loaded primary db.json');
          return parsed;
        } else {
          console.error('[CRITICAL DB ERROR] db.json does not match required schema structure.');
        }
      } catch (err: any) {
        console.error('[CRITICAL DB ERROR] Failed to read or parse primary db.json:', err.message);
      }
    }

    // 2. Try restoring from backup db.json.bak
    if (bakExists) {
      console.warn('[DB RECOVERY] Attempting recovery from db.json.bak...');
      try {
        const bakContent = fs.readFileSync(BAK_PATH, 'utf-8');
        const bakParsed = JSON.parse(bakContent);
        if (isValidDBStructure(bakParsed)) {
          console.log('[DB RECOVERY SUCCESS] Restored valid database from db.json.bak');
          // Restore db.json from backup directly without overwriting backup with corrupt file
          try {
            fs.writeFileSync(DB_PATH, JSON.stringify(bakParsed, null, 2), 'utf-8');
          } catch (e) {
            console.error('Failed to rewrite restored db.json from backup:', e);
          }
          return bakParsed;
        } else {
          console.error('[CRITICAL DB ERROR] Backup file db.json.bak does not match required schema.');
        }
      } catch (err: any) {
        console.error('[CRITICAL DB ERROR] Failed to read or parse db.json.bak:', err.message);
      }
    }

    // 3. Check if this is a fresh install (neither file exists) vs a corrupted existing database
    if (!dbExists && !bakExists) {
      console.log('[DB INIT] No database file found on disk. Initializing fresh template...');
      this.saveSync(INITIAL_DATA);
      return INITIAL_DATA;
    }

    // 4. CRITICAL RECOVERY FAILURE: Both files exist (or existed) but failed to load.
    // DO NOT OVERWRITE WITH INITIAL_DATA! Halt execution to prevent data loss.
    console.error('================================================================');
    console.error('CRITICAL FATAL DATABASE RECOVERY ERROR:');
    console.error('Both db.json and db.json.bak are corrupt or unreadable.');
    console.error('To protect user data from destruction, the backend process is stopping.');
    console.error('Please inspect db.json or restore a manual backup before restarting.');
    console.error('================================================================');
    process.exit(1);
  }

  /**
   * ATOMIC WRITE SAFETY:
   * 1. Serialize complete database.
   * 2. Write to db.json.tmp.
   * 3. Verify temporary file can be parsed successfully.
   * 4. Update db.json.bak with verified valid data.
   * 5. Replace db.json with validated temporary file.
   */
  private saveSync(data: DBTemplate) {
    try {
      const jsonStr = JSON.stringify(data, null, 2);

      // Step 1: Write to tmp file
      fs.writeFileSync(TMP_PATH, jsonStr, 'utf-8');

      // Step 2: Verify tmp file
      const verifyContent = fs.readFileSync(TMP_PATH, 'utf-8');
      const verifyParsed = JSON.parse(verifyContent);
      if (!isValidDBStructure(verifyParsed)) {
        throw new Error('Verification of db.json.tmp failed schema check.');
      }

      // Step 3: Update backup with verified valid data
      try {
        fs.writeFileSync(BAK_PATH, jsonStr, 'utf-8');
      } catch (bakErr) {
        console.warn('Warning: Failed to update db.json.bak:', bakErr);
      }

      // Step 4: Atomic replace db.json
      try {
        fs.renameSync(TMP_PATH, DB_PATH);
      } catch (renameErr) {
        // Fallback for cross-device or Windows rename lock
        fs.copyFileSync(TMP_PATH, DB_PATH);
        if (fs.existsSync(TMP_PATH)) {
          fs.unlinkSync(TMP_PATH);
        }
      }
    } catch (err: any) {
      console.error('[CRITICAL DB SAVE ERROR] Atomic database write failed:', err.message);
      if (fs.existsSync(TMP_PATH)) {
        try { fs.unlinkSync(TMP_PATH); } catch (e) {}
      }
      throw err;
    }
  }

  /**
   * CONCURRENCY MUTEX QUEUE:
   * Enqueues tasks so concurrent HTTP requests execute reads/writes sequentially.
   */
  public enqueue<T>(task: () => Promise<T> | T): Promise<T> {
    const res = this.writeQueue.then(async () => {
      return await task();
    });
    this.writeQueue = res.catch(() => {});
    return res;
  }

  // --- Synchronous methods (internally used by queued operations) ---

  public findSync(collection: keyof DBTemplate, predicate: (item: any) => boolean) {
    return this.data[collection].find(predicate);
  }

  public filterSync(collection: keyof DBTemplate, predicate: (item: any) => boolean) {
    return this.data[collection].filter(predicate);
  }

  public insertSync(collection: keyof DBTemplate, item: any) {
    this.data[collection].push(item);
    this.saveSync(this.data);
    return item;
  }

  public updateSync(collection: keyof DBTemplate, predicate: (item: any) => boolean, updates: any) {
    const items = this.data[collection];
    const index = items.findIndex(predicate);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      this.saveSync(this.data);
      return items[index];
    }
    return null;
  }

  public deleteSync(collection: keyof DBTemplate, predicate: (item: any) => boolean) {
    const initialLength = this.data[collection].length;
    this.data[collection] = this.data[collection].filter(item => !predicate(item));
    if (this.data[collection].length !== initialLength) {
      this.saveSync(this.data);
      return true;
    }
    return false;
  }

  // --- Async Queued Public API (Thread-Safe / Mutex-Protected) ---

  public find(collection: keyof DBTemplate, predicate: (item: any) => boolean): Promise<any> {
    return this.enqueue(() => this.findSync(collection, predicate));
  }

  public filter(collection: keyof DBTemplate, predicate: (item: any) => boolean): Promise<any[]> {
    return this.enqueue(() => this.filterSync(collection, predicate));
  }

  public insert(collection: keyof DBTemplate, item: any): Promise<any> {
    return this.enqueue(() => this.insertSync(collection, item));
  }

  public update(collection: keyof DBTemplate, predicate: (item: any) => boolean, updates: any): Promise<any> {
    return this.enqueue(() => this.updateSync(collection, predicate, updates));
  }

  public upsert(collection: keyof DBTemplate, predicate: (item: any) => boolean, item: any): Promise<any> {
    return this.enqueue(() => {
      const existing = this.updateSync(collection, predicate, item);
      if (existing) return existing;
      return this.insertSync(collection, item);
    });
  }

  public delete(collection: keyof DBTemplate, predicate: (item: any) => boolean): Promise<boolean> {
    return this.enqueue(() => this.deleteSync(collection, predicate));
  }

  /**
   * Reload database from disk inside queue (useful for testing recovery)
   */
  public reload(): Promise<DBTemplate> {
    return this.enqueue(() => {
      this.data = this.load();
      return this.data;
    });
  }
}

export const db = new FileDB();
