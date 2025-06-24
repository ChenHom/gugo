import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorHandler } from '../../../src/utils/errorHandler.js';

// 攔截 console.error 以避免測試時顯示預期的錯誤訊息
const originalConsoleError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorHandler', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const result = await ErrorHandler.withRetry(mockFn, 3);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');

      const result = await ErrorHandler.withRetry(mockFn, 3);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const mockFn = vi.fn()
        .mockRejectedValue(new Error('Persistent failure'));

      await expect(ErrorHandler.withRetry(mockFn, 2)).rejects.toThrow('Persistent failure');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleAsyncError', () => {
    it('should execute function successfully', async () => {
      const mockFn = async () => 'success';
      const wrappedFn = ErrorHandler.handleAsyncError(mockFn);
      const result = await wrappedFn();
      expect(result).toBe('success');
    });

    it('should handle and re-throw async errors', async () => {
      const mockFn = async () => {
        throw new Error('Test error');
      };

      const wrappedFn = ErrorHandler.handleAsyncError(mockFn);
      await expect(wrappedFn()).rejects.toThrow('Test error');
    });
  });

  describe('logError', () => {
    it('should log error without throwing', async () => {
      const testError = new Error('Test error');

      // 測試 logError 不會拋出異常（即使檔案寫入失敗）
      await expect(ErrorHandler.logError(testError, 'test-context')).resolves.not.toThrow();
    });
  });
});
