// tests/setup.ts
import { vi } from 'vitest';

// 設置測試環境變數
process.env.NODE_ENV = 'test';
process.env.CACHE_DISABLED = 'true';

// Mock console 方法以避免測試輸出過多訊息
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// 在測試中只顯示錯誤，除非特別需要
console.log = vi.fn();
console.error = vi.fn();
console.warn = vi.fn();

// 在需要時恢復原始方法
export function restoreConsole() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
}

// 簡化全域 fetch mock
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ status: 200, msg: 'Success', data: [] }),
  })
) as any;
