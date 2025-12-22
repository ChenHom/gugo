/**
 * 自定義錯誤類別：API 配額已用盡
 * 這個錯誤不應該記錄完整的 stack trace，因為這是預期中的情況
 */
export class QuotaExceededError extends Error {
  public readonly apiName: string;
  public readonly datasetName: string | undefined;

  constructor(apiName: string, datasetName?: string) {
    const message = datasetName
      ? `${apiName} API 配額已用盡 (${datasetName})`
      : `${apiName} API 配額已用盡`;
    
    super(message);
    this.name = 'QuotaExceededError';
    this.apiName = apiName;
    this.datasetName = datasetName;
    
    // 保持適當的 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, QuotaExceededError);
    }
  }
}

/**
 * 檢查錯誤是否為配額錯誤
 */
export function isQuotaError(error: unknown): error is QuotaExceededError {
  if (error instanceof QuotaExceededError) {
    return true;
  }
  
  if (error instanceof Error) {
    return (
      error.message.includes('402 Payment Required') ||
      error.message.includes('quota') ||
      error.message.includes('配額')
    );
  }
  
  return false;
}
