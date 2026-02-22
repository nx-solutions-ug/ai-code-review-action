/**
 * Type definitions for AI Code Review Action
 */

export interface Config {
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  prompt: string;
  githubToken: string;
  reviewMode: 'summary' | 'detailed' | 'security' | 'performance';
  maxFiles: number;
  excludePatterns: string[];
  failOnError: boolean;
  postAsReview: boolean;
}

export interface PullRequestFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url: string;
  raw_url: string;
  previous_filename?: string;
}

export interface ReviewComment {
  path: string;
  line: number;
  start_line?: number;
  body: string;
  side?: 'LEFT' | 'RIGHT';
  start_side?: 'LEFT' | 'RIGHT';
}

export interface ReviewIssue {
  line: number;
  severity: 'critical' | 'warning' | 'suggestion' | 'info';
  category: string;
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  reviews: ReviewIssue[];
  summary: string;
}

export interface FileReview {
  filePath: string;
  comments: ReviewComment[];
  summary?: string;
}

export interface ReviewSummary {
  totalFiles: number;
  filesReviewed: number;
  totalComments: number;
  criticalIssues: number;
  warnings: number;
  suggestions: number;
  summary: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GitHubContext {
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
}
