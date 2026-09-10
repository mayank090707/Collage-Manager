/**
 * MongoDB-backed Database Service
 *
 * Replaces the old file-based db.json storage.
 * Exposes the EXACT same public API (find, filter, insert, update, upsert, delete)
 * so that index.ts needs zero changes for existing collections.
 *
 * Data is now stored permanently in MongoDB Atlas and survives Render
 * restarts, redeployments, and ephemeral filesystem wipes.
 */

import { UserModel, UserDataModel, LoginActivityModel, AdminConfigModel, AdminAuditLogModel } from './models';

// Map collection name → the right Mongoose model
function getModel(collection: string) {
  if (collection === 'users')          return UserModel;
  if (collection === 'userData')       return UserDataModel;
  if (collection === 'loginActivity')  return LoginActivityModel;
  if (collection === 'adminConfig')    return AdminConfigModel;
  if (collection === 'adminAuditLog')  return AdminAuditLogModel;
  throw new Error(`Unknown collection: ${collection}`);
}

// Helper: convert a Mongoose document to a plain JS object
function toPlain(doc: any): any {
  if (!doc) return null;
  if (typeof doc.toObject === 'function') {
    const obj = doc.toObject({ versionKey: false });
    delete obj.__v;
    return obj;
  }
  return doc;
}

class MongoDBService {
  // ── Find one ─────────────────────────────────────────────────────────────
  async find(collection: string, predicate: (item: any) => boolean): Promise<any> {
    const model = getModel(collection);
    const docs = await (model as any).find({}).lean();
    return docs.find(predicate) || null;
  }

  // ── Filter many ──────────────────────────────────────────────────────────
  async filter(collection: string, predicate: (item: any) => boolean): Promise<any[]> {
    const model = getModel(collection);
    const docs = await (model as any).find({}).lean();
    return docs.filter(predicate);
  }

  // ── Insert ───────────────────────────────────────────────────────────────
  async insert(collection: string, item: any): Promise<any> {
    const model = getModel(collection);
    const { _id, __v, ...cleanItem } = item;
    const doc = new (model as any)(cleanItem);
    await doc.save();
    return toPlain(doc);
  }

  // ── Update (patch matching document) ─────────────────────────────────────
  async update(collection: string, predicate: (item: any) => boolean, updates: any): Promise<any> {
    const model = getModel(collection);
    const docs = await (model as any).find({}).lean();
    const match = docs.find(predicate);
    if (!match) return null;

    const { _id, __v, ...cleanUpdates } = updates;
    const updated = await (model as any).findByIdAndUpdate(
      match._id,
      { $set: cleanUpdates },
      { new: true, runValidators: false }
    ).lean();
    return toPlain(updated);
  }

  // ── Upsert ───────────────────────────────────────────────────────────────
  async upsert(collection: string, predicate: (item: any) => boolean, item: any): Promise<any> {
    const existing = await this.update(collection, predicate, item);
    if (existing) return existing;
    return this.insert(collection, item);
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async delete(collection: string, predicate: (item: any) => boolean): Promise<boolean> {
    const model = getModel(collection);
    const docs = await (model as any).find({}).lean();
    const match = docs.find(predicate);
    if (!match) return false;
    await (model as any).findByIdAndDelete(match._id);
    return true;
  }

  // ── Delete many (for login activity cleanup etc.) ─────────────────────────
  async deleteMany(collection: string, predicate: (item: any) => boolean): Promise<number> {
    const model = getModel(collection);
    const docs = await (model as any).find({}).lean();
    const matches = docs.filter(predicate);
    let count = 0;
    for (const m of matches) {
      await (model as any).findByIdAndDelete(m._id);
      count++;
    }
    return count;
  }

  // ── Sync helpers (compatibility with old FileDB API) ─────────────────────
  findSync    = this.find.bind(this);
  filterSync  = this.filter.bind(this);
  insertSync  = this.insert.bind(this);
  updateSync  = this.update.bind(this);
  deleteSync  = this.delete.bind(this);

  enqueue<T>(task: () => Promise<T> | T): Promise<T> {
    return Promise.resolve(task());
  }
}

export const db = new MongoDBService();

// Export type alias for shared interface compatibility
export interface DBTemplate {
  users:         any[];
  userData:      any[];
  loginActivity: any[];
  adminConfig:   any[];
  adminAuditLog: any[];
}
