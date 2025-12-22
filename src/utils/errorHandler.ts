import { promises as fs } from 'fs';
import path from 'path';
import { QuotaExceededError } from './errors.js';

export class ErrorHandler {
  private static logDir = 'logs';

  static async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // Directory already exists or other error
    }
  }

  static async logError(error: Error, context?: string): Promise<void> {
    // 跳過配額錯誤的詳細記錄（這是預期中的情況）
    if (error instanceof QuotaExceededError) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      context: context || 'Unknown',
      message: error.message,
      stack: error.stack,
    };

    // Don't write to file during tests to avoid polluting logs with mock errors
    if (process.env.NODE_ENV !== 'test') {
      const logFile = path.join(this.logDir, `error-${new Date().toISOString().split('T')[0]}.log`);

      try {
        await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
      } catch (writeError) {
        console.error('Failed to write error log:', writeError);
      }
    }

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      console.error(`[${timestamp}] Error in ${context}:`, error);
    }
  }

  static handleAsyncError(fn: (...args: any[]) => Promise<any>): (...args: any[]) => Promise<any> {
    return async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.logError(error as Error, fn.name);
        throw error;
      }
    };
  }

  static withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let lastError: Error;

      const attempt = async (attemptNumber: number) => {
        try {
          const result = await fn();
          resolve(result);
          return;
        } catch (error) {
          lastError = error as Error;
          await this.logError(lastError, `Attempt ${attemptNumber}/${maxAttempts}`);

          if (attemptNumber === maxAttempts) {
            reject(lastError);
            return;
          }

          // Exponential backoff
          const delay = delayMs * Math.pow(2, attemptNumber - 1);
          setTimeout(() => attempt(attemptNumber + 1), delay);
        }
      };

      attempt(1);
    });
  }
}
