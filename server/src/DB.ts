import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'db.json');

export interface DBTemplate {
  users: any[];
  userData: any[];
}

const INITIAL_DATA: DBTemplate = {
  users: [],
  userData: []
};

class FileDB {
  private data: DBTemplate;

  constructor() {
    this.data = this.load();
  }

  private load(): DBTemplate {
    try {
      if (fs.existsSync(DB_PATH)) {
        const content = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.error('Error loading DB:', err);
    }
    this.save(INITIAL_DATA);
    return INITIAL_DATA;
  }

  private save(data: DBTemplate) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error saving DB:', err);
    }
  }

  // Generic methods
  find(collection: keyof DBTemplate, predicate: (item: any) => boolean) {
    return this.data[collection].find(predicate);
  }

  filter(collection: keyof DBTemplate, predicate: (item: any) => boolean) {
    return this.data[collection].filter(predicate);
  }

  insert(collection: keyof DBTemplate, item: any) {
    this.data[collection].push(item);
    this.save(this.data);
    return item;
  }

  update(collection: keyof DBTemplate, predicate: (item: any) => boolean, updates: any) {
    const items = this.data[collection];
    const index = items.findIndex(predicate);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      this.save(this.data);
      return items[index];
    }
    return null;
  }

  upsert(collection: keyof DBTemplate, predicate: (item: any) => boolean, item: any) {
    const existing = this.update(collection, predicate, item);
    if (existing) return existing;
    return this.insert(collection, item);
  }

  delete(collection: keyof DBTemplate, predicate: (item: any) => boolean) {
    const initialLength = this.data[collection].length;
    this.data[collection] = this.data[collection].filter(item => !predicate(item));
    if (this.data[collection].length !== initialLength) {
      this.save(this.data);
      return true;
    }
    return false;
  }
}

export const db = new FileDB();
