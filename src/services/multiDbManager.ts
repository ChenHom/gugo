import Database from 'better-sqlite3';
import path from 'path';

/**
 * 多資料庫查詢管理器
 * 處理從不同資料庫檔案查詢資料的需求
 */
export class MultiDbQueryManager {
  private databases: Map<string, Database.Database> = new Map();

  constructor() {
    // 初始化各個資料庫連接
    this.initializeDatabases();
  }

  private initializeDatabases(): void {
    const dbPaths = {
      fundamentals: path.join(process.cwd(), 'data', 'fundamentals.db'),
      quality: path.join(process.cwd(), 'data', 'quality.db'),
      price: path.join(process.cwd(), 'data', 'price.db'),
    };

    for (const [name, dbPath] of Object.entries(dbPaths)) {
      try {
        const db = new Database(dbPath);
        this.databases.set(name, db);
      } catch (error) {
        console.warn(`⚠️  無法連接到 ${name} 資料庫: ${dbPath}`);
      }
    }
  }

  /**
   * 從指定資料庫查詢資料
   */
  query<T = any>(dbName: string, sql: string, params: any[] = []): T[] {
    const db = this.databases.get(dbName);
    if (!db) {
      console.warn(`⚠️  資料庫 ${dbName} 不存在`);
      return [];
    }

    try {
      return db.prepare(sql).all(...params) as T[];
    } catch (error) {
      console.warn(`⚠️  查詢失敗 (${dbName}): ${sql}`, error);
      return [];
    }
  }

  /**
   * 查詢估值資料
   */
  queryValuation<T = any>(sql: string, params: any[] = []): T[] {
    return this.query<T>('fundamentals', sql, params);
  }

  /**
   * 查詢成長資料
   */
  queryGrowth<T = any>(sql: string, params: any[] = []): T[] {
    return this.query<T>('fundamentals', sql, params);
  }

  /**
   * 查詢品質資料
   */
  queryQuality<T = any>(sql: string, params: any[] = []): T[] {
    return this.query<T>('quality', sql, params);
  }

  /**
   * 查詢資金流向資料
   */
  queryFundFlow<T = any>(sql: string, params: any[] = []): T[] {
    return this.query<T>('fundamentals', sql, params);
  }

  /**
   * 查詢動能資料
   */
  queryMomentum<T = any>(sql: string, params: any[] = []): T[] {
    return this.query<T>('fundamentals', sql, params);
  }

  /**
   * 查詢價格資料
   */
  queryPrice<T = any>(sql: string, params: any[] = []): T[] {
    return this.query<T>('price', sql, params);
  }

  /**
   * 關閉所有資料庫連接
   */
  close(): void {
    for (const db of this.databases.values()) {
      try {
        db.close();
      } catch (error) {
        // 忽略關閉錯誤
      }
    }
    this.databases.clear();
  }
}

// 單例實例
let multiDbManager: MultiDbQueryManager | null = null;

export function getMultiDbManager(): MultiDbQueryManager {
  if (!multiDbManager) {
    multiDbManager = new MultiDbQueryManager();
  }
  return multiDbManager;
}

export function closeAllDatabases(): void {
  if (multiDbManager) {
    multiDbManager.close();
    multiDbManager = null;
  }
}
