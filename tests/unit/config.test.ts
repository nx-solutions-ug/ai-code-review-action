import { loadConfig, getDefaultPrompt } from '../../src/config';
import * as core from '@actions/core';

// Mock @actions/core
jest.mock('@actions/core');

describe('loadConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load valid configuration', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'LLM_BASE_URL': 'https://api.openai.com/v1',
        'LLM_MODEL': 'gpt-4o',
        'LLM_API_KEY': 'test-api-key',
        'GITHUB_TOKEN': 'test-token',
        'REVIEW_MODE': 'detailed',
        'MAX_FILES': '50',
        'EXCLUDE_PATTERNS': '*.lock,*.min.js',
        'FAIL_ON_ERROR': 'false',
        'POST_AS_REVIEW': 'true',
      };
      return inputs[name] || '';
    });

    const config = loadConfig();

    expect(config.llmBaseUrl).toBe('https://api.openai.com/v1');
    expect(config.llmModel).toBe('gpt-4o');
    expect(config.reviewMode).toBe('detailed');
    expect(config.maxFiles).toBe(50);
    expect(config.excludePatterns).toEqual(['*.lock', '*.min.js']);
    expect(config.failOnError).toBe(false);
    expect(config.postAsReview).toBe(true);
  });

  it('should throw error for invalid review mode', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'LLM_BASE_URL': 'https://api.openai.com/v1',
        'LLM_MODEL': 'gpt-4o',
        'LLM_API_KEY': 'test-api-key',
        'GITHUB_TOKEN': 'test-token',
        'REVIEW_MODE': 'invalid-mode',
      };
      return inputs[name] || '';
    });

    expect(() => loadConfig()).toThrow('Invalid REVIEW_MODE');
  });

  it('should throw error for invalid URL', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'LLM_BASE_URL': 'not-a-valid-url',
        'LLM_MODEL': 'gpt-4o',
        'LLM_API_KEY': 'test-api-key',
        'GITHUB_TOKEN': 'test-token',
      };
      return inputs[name] || '';
    });

    expect(() => loadConfig()).toThrow('Invalid LLM_BASE_URL');
  });

  it('should mask sensitive inputs', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'LLM_BASE_URL': 'https://api.openai.com/v1',
        'LLM_MODEL': 'gpt-4o',
        'LLM_API_KEY': 'secret-api-key',
        'GITHUB_TOKEN': 'secret-token',
      };
      return inputs[name] || '';
    });

    loadConfig();

    expect(core.setSecret).toHaveBeenCalledWith('secret-api-key');
    expect(core.setSecret).toHaveBeenCalledWith('secret-token');
  });
});

describe('getDefaultPrompt', () => {
  it('should return detailed prompt by default', () => {
    const prompt = getDefaultPrompt('unknown');
    expect(prompt).toContain('Security');
    expect(prompt).toContain('Performance');
  });

  it('should return security prompt for security mode', () => {
    const prompt = getDefaultPrompt('security');
    expect(prompt).toContain('security');
    expect(prompt).toContain('vulnerabilities');
  });

  it('should return performance prompt for performance mode', () => {
    const prompt = getDefaultPrompt('performance');
    expect(prompt).toContain('performance');
    expect(prompt).toContain('optimization');
  });
});
