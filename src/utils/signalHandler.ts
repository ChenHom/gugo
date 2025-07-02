/**
 * 通用信號處理工具
 * 提供優雅的程序中斷處理
 */

export interface SignalHandlerOptions {
  /** 程序描述，用於顯示退出訊息 */
  processName?: string;
  /** 清理函數陣列 */
  cleanupFunctions?: Array<() => Promise<void> | void>;
  /** 是否顯示退出訊息 */
  silent?: boolean;
}

export class SignalHandler {
  private static instance: SignalHandler | null = null;
  private cleanupFunctions: Array<() => Promise<void> | void> = [];
  private processName: string = 'CLI 程序';
  private silent: boolean = false;
  private isExiting: boolean = false;

  private constructor() {
    this.setupSignalHandlers();
  }

  static getInstance(): SignalHandler {
    if (!SignalHandler.instance) {
      SignalHandler.instance = new SignalHandler();
    }
    return SignalHandler.instance;
  }

  /**
   * 初始化信號處理器
   */
  static setup(options: SignalHandlerOptions = {}): SignalHandler {
    const handler = SignalHandler.getInstance();
    handler.configure(options);
    return handler;
  }

  /**
   * 配置信號處理器
   */
  configure(options: SignalHandlerOptions): void {
    this.processName = options.processName || this.processName;
    this.silent = options.silent || false;

    if (options.cleanupFunctions) {
      this.cleanupFunctions.push(...options.cleanupFunctions);
    }
  }

  /**
   * 添加清理函數
   */
  addCleanupFunction(fn: () => Promise<void> | void): void {
    this.cleanupFunctions.push(fn);
  }

  /**
   * 設置信號處理器
   */
  private setupSignalHandlers(): void {
    // Ctrl+C (SIGINT)
    process.on('SIGINT', this.handleSignal.bind(this, 'SIGINT'));

    // 終止信號 (SIGTERM)
    process.on('SIGTERM', this.handleSignal.bind(this, 'SIGTERM'));

    // 未捕獲的異常
    process.on('uncaughtException', (error) => {
      console.error('\n❌ 未捕獲的異常:', error.message);
      this.gracefulExit(1);
    });

    // 未處理的 Promise 拒絕
    process.on('unhandledRejection', (reason, promise) => {
      console.error('\n❌ 未處理的 Promise 拒絕:', reason);
      this.gracefulExit(1);
    });
  }

  /**
   * 處理信號
   */
  private async handleSignal(signal: string): Promise<void> {
    if (this.isExiting) {
      return;
    }

    this.isExiting = true;

    if (!this.silent) {
      console.log(`\n\n⚠️  收到中斷信號 (${signal})，正在安全退出 ${this.processName}...`);
    }

    await this.gracefulExit(0);
  }

  /**
   * 優雅退出
   */
  private async gracefulExit(code: number): Promise<void> {
    try {
      // 執行所有清理函數
      if (this.cleanupFunctions.length > 0) {
        if (!this.silent) {
          console.log('🧹 執行清理作業...');
        }

        for (const cleanup of this.cleanupFunctions) {
          try {
            await cleanup();
          } catch (error) {
            console.error('清理函數執行失敗:', error);
          }
        }
      }

      if (!this.silent) {
        console.log(`✅ ${this.processName} 已安全退出`);
      }

    } catch (error) {
      console.error('退出時發生錯誤:', error);
    }

    process.exit(code);
  }

  /**
   * 手動觸發退出
   */
  async exit(code: number = 0): Promise<void> {
    await this.gracefulExit(code);
  }

  /**
   * 重置實例（主要用於測試）
   */
  static reset(): void {
    SignalHandler.instance = null;
  }
}

/**
 * 簡化的信號處理器設置函數
 */
export function setupSignalHandler(options: SignalHandlerOptions = {}): SignalHandler {
  return SignalHandler.setup(options);
}

/**
 * 為 CLI 命令提供的便捷函數
 */
export function setupCliSignalHandler(commandName: string): SignalHandler {
  return setupSignalHandler({
    processName: commandName,
    silent: false
  });
}
