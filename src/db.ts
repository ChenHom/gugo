import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || 'data/fundamentals.db';
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
  }
  return db;
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  const database = getDb();
  return database.prepare(sql).all(...params) as T[];
}

export function close(): void {
  if (db) {
    db.close();
    db = null;
  }
}
