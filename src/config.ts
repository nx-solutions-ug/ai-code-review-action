import * as core from '@actions/core';
import { Config } from './types';

/**
 * Default prompts for different review modes
 */
const DEFAULT_PROMPTS: Record<string, string> = {
  summary: `You are an expert code reviewer. Provide a high-level summary of the code changes.

Review the following pull request and provide:
1. A brief summary of what the changes do
2. Any potential concerns or issues at a high level
3. Overall assessment of code quality

Output format (JSON):
{
  "summary": "Brief overall assessment (2-3 sentences)",
  "reviews": []
}`,

  detailed: `You are an expert code reviewer. Analyze the provided code changes and provide actionable feedback.

Review Criteria:
1. **Security**: Identify potential vulnerabilities (SQL injection, XSS, unsafe eval, hardcoded secrets, etc.)
2. **Performance**: Flag inefficient algorithms, memory leaks, or unnecessary computations
3. **Maintainability**: Check for code smells, duplication, and complexity
4. **Best Practices**: Verify error handling, logging, and testing coverage
5. **Style**: Note deviations from language conventions

Output Format (JSON):
{
  "reviews": [
    {
      "line": <line_number>,
      "severity": "critical|warning|suggestion|info",
      "category": "security|performance|maintainability|style|best-practice",
      "message": "Clear explanation of the issue",
      "suggestion": "Specific code suggestion if applicable"
    }
  ],
  "summary": "Brief overall assessment"
}

Rules:
- Only comment on changed lines (the diff)
- Be specific and actionable
- Prioritize critical issues
- If no issues found, return empty reviews array`,

  security: `You are a security-focused code reviewer. Focus exclusively on security vulnerabilities and best practices.

Security Review Checklist:
1. **Injection vulnerabilities**: SQL injection, command injection, XSS
2. **Authentication/Authorization**: Weak auth, missing auth checks, privilege escalation
3. **Data exposure**: Hardcoded secrets, sensitive data in logs, insecure storage
4. **Cryptography**: Weak algorithms, improper key management, missing encryption
5. **Input validation**: Missing validation, unsafe deserialization
6. **Dependencies**: Known vulnerable libraries (if package files changed)

Output Format (JSON):
{
  "reviews": [
    {
      "line": <line_number>,
      "severity": "critical|warning|suggestion",
      "category": "security",
      "message": "Security issue description",
      "suggestion": "How to fix it"
    }
  ],
  "summary": "Security assessment summary"
}

Flag ANY security concern, even minor ones.`,

  performance: `You are a performance-focused code reviewer. Focus on code efficiency and optimization opportunities.

Performance Review Checklist:
1. **Algorithm complexity**: O(n²) when O(n) is possible, unnecessary loops
2. **Memory usage**: Memory leaks, large object retention, inefficient data structures
3. **I/O operations**: Unnecessary file/database operations, N+1 queries
4. **Caching**: Missing cache opportunities, cache invalidation issues
5. **Async operations**: Blocking calls, missing Promise.all() opportunities
6. **Resource cleanup**: Unclosed connections, file handles, event listeners

Output Format (JSON):
{
  "reviews": [
    {
      "line": <line_number>,
      "severity": "critical|warning|suggestion",
      "category": "performance",
      "message": "Performance issue description",
      "suggestion": "Optimization suggestion"
    }
  ],
  "summary": "Performance assessment summary"
}`,
};

/**
 * Load and validate configuration from action inputs
 */
export function loadConfig(): Config {
  const llmBaseUrl = core.getInput('LLM_BASE_URL', { required: true });
  const llmModel = core.getInput('LLM_MODEL', { required: true });
  const llmApiKey = core.getInput('LLM_API_KEY', { required: true });
  const customPrompt = core.getInput('PROMPT');
  const githubToken = core.getInput('GITHUB_TOKEN', { required: true });
  const reviewMode = core.getInput('REVIEW_MODE') || 'detailed';
  const maxFiles = parseInt(core.getInput('MAX_FILES') || '50', 10);
  const excludePatternsInput = core.getInput('EXCLUDE_PATTERNS');
  const failOnError = core.getInput('FAIL_ON_ERROR') === 'true';
  const postAsReview = core.getInput('POST_AS_REVIEW') !== 'false';

  // Validate review mode
  const validModes = ['summary', 'detailed', 'security', 'performance'];
  if (!validModes.includes(reviewMode)) {
    throw new Error(
      `Invalid REVIEW_MODE: ${reviewMode}. Must be one of: ${validModes.join(', ')}`
    );
  }

  // Validate URL
  try {
    const url = new URL(llmBaseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('URL must use HTTP or HTTPS protocol');
    }
  } catch (error) {
    throw new Error(`Invalid LLM_BASE_URL: ${llmBaseUrl}`);
  }

  // Parse exclude patterns
  const excludePatterns = excludePatternsInput
    ? excludePatternsInput.split(',').map(p => p.trim()).filter(Boolean)
    : ['*.lock', '*.min.js', '*.min.css', 'dist/**', 'build/**', 'node_modules/**', 'coverage/**'];

  // Determine prompt to use
  const prompt = customPrompt || DEFAULT_PROMPTS[reviewMode];

  // Mask sensitive inputs
  core.setSecret(llmApiKey);
  core.setSecret(githubToken);

  const config: Config = {
    llmBaseUrl,
    llmModel,
    llmApiKey,
    prompt,
    githubToken,
    reviewMode: reviewMode as Config['reviewMode'],
    maxFiles,
    excludePatterns,
    failOnError,
    postAsReview,
  };

  // Log configuration (without secrets)
  core.info('Configuration loaded:');
  core.info(`  LLM Base URL: ${config.llmBaseUrl}`);
  core.info(`  LLM Model: ${config.llmModel}`);
  core.info(`  Review Mode: ${config.reviewMode}`);
  core.info(`  Max Files: ${config.maxFiles || 'unlimited'}`);
  core.info(`  Exclude Patterns: ${config.excludePatterns.join(', ')}`);
  core.info(`  Post as Review: ${config.postAsReview}`);
  core.info(`  Fail on Error: ${config.failOnError}`);

  return config;
}

/**
 * Get the default prompt for a review mode
 */
export function getDefaultPrompt(mode: string): string {
  return DEFAULT_PROMPTS[mode] || DEFAULT_PROMPTS.detailed;
}
