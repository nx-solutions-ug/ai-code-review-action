import { withRetry, RetryExhaustedError } from '../../src/utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return result on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    
    const result = await withRetry(operation);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValue('success');
    
    const result = await withRetry(operation, { maxAttempts: 3, backoffMs: 10 });
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should throw RetryExhaustedError after max attempts', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    
    await expect(withRetry(operation, { maxAttempts: 2, backoffMs: 10 }))
      .rejects
      .toThrow(RetryExhaustedError);
    
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable error', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Invalid request'));
    
    await expect(withRetry(operation, { maxAttempts: 3 }))
      .rejects
      .toThrow('Invalid request');
    
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValue('success');
    
    const startTime = Date.now();
    await withRetry(operation, { maxAttempts: 3, backoffMs: 50 });
    const duration = Date.now() - startTime;
    
    // Should have waited at least 50ms + 100ms = 150ms
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
