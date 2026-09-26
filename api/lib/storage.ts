import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore/lite';
import { getFirestoreDb } from './firebase.ts';

// Helper to retry transient cloud network errors (ECONNRESET, UNAVAILABLE)
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, delayMs = 200): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isTransient =
        err?.code === 14 ||
        err?.code === 'unavailable' ||
        err?.message?.includes('ECONNRESET') ||
        err?.message?.includes('UNAVAILABLE') ||
        err?.message?.includes('network');
      if (attempt < maxRetries && isTransient) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export type TableName =
  | 'users'
  | 'shopee_accounts'
  | 'addresses'
  | 'target_urls'
  | 'proxies'
  | 'schedules'
  | 'shopee_payments'
  | 'order_history'
  | 'logs';

export const VALID_TABLES: TableName[] = [
  'users',
  'shopee_accounts',
  'addresses',
  'target_urls',
  'proxies',
  'schedules',
  'shopee_payments',
  'order_history',
  'logs',
];

const TABLE_ALIAS_MAP: Record<string, TableName> = {
  'users': 'users',
  'shopee-accounts': 'shopee_accounts',
  'shopee_accounts': 'shopee_accounts',
  'addresses': 'addresses',
  'target-urls': 'target_urls',
  'target_urls': 'target_urls',
  'proxies': 'proxies',
  'schedules': 'schedules',
  'shopee-payments': 'shopee_payments',
  'shopee_payments': 'shopee_payments',
  'order-history': 'order_history',
  'order_history': 'order_history',
  'logs': 'logs',
};

export function normalizeTableName(table: string): TableName | null {
  const clean = table.toLowerCase().trim();
  return TABLE_ALIAS_MAP[clean] || null;
}

export interface StorageOptions {
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
}

function getLocalPath(table: TableName): string {
  return path.join(process.cwd(), 'database', `${table}.json`);
}

function readLocalSeed<T = any>(table: TableName): T[] {
  const filePath = getLocalPath(table);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw || '[]');
    }
  } catch (err) {
    console.error(`Error reading local seed for ${table}:`, err);
  }
  return [];
}

export interface StorageAdapter {
  name: string;
  isAvailable(): boolean;
  list<T = any>(table: TableName, filters?: Record<string, any>, options?: StorageOptions): Promise<T[]>;
  get<T = any>(table: TableName, id: string): Promise<T | null>;
  create<T = any>(table: TableName, payload: Record<string, any>): Promise<T>;
  update<T = any>(table: TableName, id: string, updates: Record<string, any>): Promise<T | null>;
  delete(table: TableName, id: string): Promise<boolean>;
  migrateAll(force?: boolean): Promise<Record<string, { status: string; count: number }>>;
}

/**
 * FIREBASE FIRESTORE STORAGE ADAPTER
 */
class FirestoreStorageAdapter implements StorageAdapter {
  name = 'Firebase Firestore';

  isAvailable(): boolean {
    return getFirestoreDb() !== null;
  }

  async list<T = any>(
    table: TableName,
    filters: Record<string, any> = {},
    options: StorageOptions = {}
  ): Promise<T[]> {
    const db = getFirestoreDb();
    if (!db) throw new Error('Firestore database not available');

    try {
      const colRef = collection(db, table);
      const queryConstraints: any[] = [];

      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== '') {
          queryConstraints.push(where(key, '==', val));
        }
      }

      if (options.sort) {
        queryConstraints.push(orderBy(options.sort, options.order === 'desc' ? 'desc' : 'asc'));
      }

      if (options.limit && options.limit > 0) {
        queryConstraints.push(firestoreLimit(options.limit));
      }

      let q = queryConstraints.length > 0 ? query(colRef, ...queryConstraints) : query(colRef);
      const snapshot = await withRetry(() => getDocs(q));

      if (snapshot.empty) {
        // If collection is completely empty, check if we need initial seeding from local seed
        const checkAll = await withRetry(() => getDocs(colRef));
        if (checkAll.empty) {
          const seeds = readLocalSeed<T>(table);
          if (seeds.length > 0) {
            console.log(`[Firestore] Auto-seeding collection: ${table} (${seeds.length} records)`);
            for (const item of seeds) {
              const docId = (item as any).id || crypto.randomUUID();
              await withRetry(() => setDoc(doc(db, table, docId), item as any));
            }
            // Re-fetch with filters
            return this.list(table, filters, options);
          }
        }
      }

      const results: T[] = [];
      snapshot.forEach((docSnap) => {
        results.push({ id: docSnap.id, ...docSnap.data() } as T);
      });

      return results;
    } catch (err: any) {
      console.warn(`[Firestore] list error on ${table}:`, err?.message);
      // Fallback to local memory/seed query
      let records = readLocalSeed<T>(table);
      for (const [k, v] of Object.entries(filters)) {
        records = records.filter((r: any) => String(r[k]) === String(v));
      }
      return records;
    }
  }

  async get<T = any>(table: TableName, id: string): Promise<T | null> {
    const db = getFirestoreDb();
    if (!db) return null;

    try {
      const docRef = doc(db, table, id);
      const docSnap = await withRetry(() => getDoc(docRef));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (err) {
      console.warn(`[Firestore] get error on ${table}/${id}:`, err);
      const local = readLocalSeed(table);
      return local.find((r: any) => String(r.id) === String(id)) || null;
    }
  }

  async create<T = any>(table: TableName, payload: Record<string, any>): Promise<T> {
    const db = getFirestoreDb();
    if (!db) throw new Error('Firestore not available');

    const id = payload.id || crypto.randomUUID();
    const created_at = payload.created_at || new Date().toISOString();
    const newRecord = {
      ...payload,
      id,
      created_at,
    } as T;

    const docRef = doc(db, table, id);
    await withRetry(() => setDoc(docRef, newRecord as any));
    return newRecord;
  }

  async update<T = any>(
    table: TableName,
    id: string,
    updates: Record<string, any>
  ): Promise<T | null> {
    const db = getFirestoreDb();
    if (!db) throw new Error('Firestore not available');

    const docRef = doc(db, table, id);
    const existing = await withRetry(() => getDoc(docRef));

    if (!existing.exists()) {
      // Support upsert for shopee_payments if user_id was passed
      if (table === 'shopee_payments') {
        const payload = { ...updates, id, updated_at: new Date().toISOString() };
        await withRetry(() => setDoc(docRef, payload));
        return payload as T;
      }
      return null;
    }

    const payload = {
      ...updates,
      updated_at: updates.updated_at || new Date().toISOString(),
    };

    await withRetry(() => updateDoc(docRef, payload));
    const updatedSnap = await withRetry(() => getDoc(docRef));
    return { id: updatedSnap.id, ...updatedSnap.data() } as T;
  }

  async delete(table: TableName, id: string): Promise<boolean> {
    const db = getFirestoreDb();
    if (!db) return false;

    const docRef = doc(db, table, id);
    await withRetry(() => deleteDoc(docRef));
    return true;
  }

  async migrateAll(force = false): Promise<Record<string, { status: string; count: number }>> {
    const db = getFirestoreDb();
    if (!db) throw new Error('Firestore not available');

    const report: Record<string, { status: string; count: number }> = {};
    for (const table of VALID_TABLES) {
      const colRef = collection(db, table);
      const snapshot = await withRetry(() => getDocs(colRef));
      const seeds = readLocalSeed(table);

      if (snapshot.empty || force) {
        let count = 0;
        for (const item of seeds) {
          const docId = (item as any).id || crypto.randomUUID();
          await withRetry(() => setDoc(doc(db, table, docId), item));
          count++;
        }
        report[table] = { status: 'seeded_to_cloud', count };
      } else {
        report[table] = { status: 'existing_in_cloud', count: snapshot.size };
      }
    }
    return report;
  }
}

/**
 * LOCAL FILESYSTEM ADAPTER (FALLBACK)
 */
class LocalFsStorageAdapter implements StorageAdapter {
  name = 'Local Filesystem';

  isAvailable(): boolean {
    return true;
  }

  async list<T = any>(
    table: TableName,
    filters: Record<string, any> = {},
    options: StorageOptions = {}
  ): Promise<T[]> {
    let records = readLocalSeed<T>(table);
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        records = records.filter((r: any) => String(r[key]) === String(val));
      }
    }
    if (options.sort) {
      const sortKey = options.sort;
      const isAsc = options.order !== 'desc';
      records.sort((a: any, b: any) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        return isAsc ? (valA < valB ? -1 : 1) : valA < valB ? 1 : -1;
      });
    }
    if (options.limit && options.limit > 0) {
      records = records.slice(0, options.limit);
    }
    return records;
  }

  async get<T = any>(table: TableName, id: string): Promise<T | null> {
    const records = readLocalSeed<T>(table);
    return records.find((r: any) => String(r.id) === String(id)) || null;
  }

  async create<T = any>(table: TableName, payload: Record<string, any>): Promise<T> {
    const records = readLocalSeed(table);
    const id = payload.id || crypto.randomUUID();
    const created_at = payload.created_at || new Date().toISOString();
    const newRecord = { ...payload, id, created_at };
    records.push(newRecord);
    fs.writeFileSync(getLocalPath(table), JSON.stringify(records, null, 2), 'utf8');
    return newRecord as T;
  }

  async update<T = any>(
    table: TableName,
    id: string,
    updates: Record<string, any>
  ): Promise<T | null> {
    const records = readLocalSeed(table);
    const idx = records.findIndex((r: any) => String(r.id) === String(id));
    if (idx === -1) {
      if (table === 'shopee_payments') {
        const newRecord = { ...updates, id, updated_at: new Date().toISOString() };
        records.push(newRecord);
        fs.writeFileSync(getLocalPath(table), JSON.stringify(records, null, 2), 'utf8');
        return newRecord as T;
      }
      return null;
    }
    records[idx] = { ...records[idx], ...updates, updated_at: new Date().toISOString() };
    fs.writeFileSync(getLocalPath(table), JSON.stringify(records, null, 2), 'utf8');
    return records[idx] as T;
  }

  async delete(table: TableName, id: string): Promise<boolean> {
    const records = readLocalSeed(table);
    const filtered = records.filter((r: any) => String(r.id) !== String(id));
    if (filtered.length !== records.length) {
      fs.writeFileSync(getLocalPath(table), JSON.stringify(filtered, null, 2), 'utf8');
      return true;
    }
    return false;
  }

  async migrateAll(): Promise<Record<string, { status: string; count: number }>> {
    const report: Record<string, { status: string; count: number }> = {};
    for (const t of VALID_TABLES) {
      report[t] = { status: 'local_ready', count: readLocalSeed(t).length };
    }
    return report;
  }
}

/**
 * UNIFIED STORAGE MANAGER
 */
class StorageManager {
  private adapter: StorageAdapter;

  constructor() {
    const firestoreAdapter = new FirestoreStorageAdapter();
    if (firestoreAdapter.isAvailable()) {
      this.adapter = firestoreAdapter;
      console.log(`[Storage] Active Provider: ${this.adapter.name}`);
    } else {
      this.adapter = new LocalFsStorageAdapter();
      console.log(`[Storage] Fallback Provider: ${this.adapter.name}`);
    }
  }

  getAdapterName(): string {
    return this.adapter.name;
  }

  isConfigured(): boolean {
    return true;
  }

  async list<T = any>(table: TableName, filters?: Record<string, any>, options?: StorageOptions): Promise<T[]> {
    return this.adapter.list<T>(table, filters, options);
  }

  async get<T = any>(table: TableName, id: string): Promise<T | null> {
    return this.adapter.get<T>(table, id);
  }

  async create<T = any>(table: TableName, payload: Record<string, any>): Promise<T> {
    return this.adapter.create<T>(table, payload);
  }

  async update<T = any>(table: TableName, id: string, updates: Record<string, any>): Promise<T | null> {
    return this.adapter.update<T>(table, id, updates);
  }

  async delete(table: TableName, id: string): Promise<boolean> {
    return this.adapter.delete(table, id);
  }

  async migrateAll(force = false): Promise<Record<string, { status: string; count: number }>> {
    return this.adapter.migrateAll(force);
  }
}

export const storage = new StorageManager();
