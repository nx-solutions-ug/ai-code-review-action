import * as core from '@actions/core';

export interface RetryOptions {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
  retryableErrors: string[];
}

export class RetryExhaustedError extends Error {
  constructor(
    public readonly originalError: Error,
    public readonly attempts: number
  ) {
    super(`Failed after ${attempts} attempts: ${originalError.message}`);
    this.name = 'RetryExhaustedError';
  }
}

function isRetryable(error: unknown, retryableErrors: string[]): boolean {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryable =>
      errorMessage.includes(retryable.toLowerCase())
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: RetryOptions = {
    maxAttempts: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', '429', '503', '502', '504'],
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === config.maxAttempts) {
        throw new RetryExhaustedError(lastError, attempt);
      }

      if (!isRetryable(error, config.retryableErrors)) {
        throw error;
      }

      const delay = Math.min(
        config.backoffMs * Math.pow(2, attempt - 1),
        config.maxBackoffMs
      );

      core.warning(
        `Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error in retry loop');
}
