#!/usr/bin/env ts-node
/**
 * Manual test script for running the AI Code Review Action locally
 * This allows testing without needing a real GitHub PR
 */

import * as dotenv from 'dotenv';
import { GitHubClient } from '../src/github/client';
import { LLMClient } from '../src/llm/client';
import { ReviewOrchestrator } from '../src/review/orchestrator';
import { Config, PullRequestFile, GitHubContext } from '../src/types';
import { logger } from '../src/utils/logger';

// Load environment variables from .env file
dotenv.config();

/**
 * Mock GitHub client for local testing
 */
class MockGitHubClient extends GitHubClient {
  private mockFiles: PullRequestFile[];

  constructor(context: GitHubContext, mockFiles: PullRequestFile[]) {
    super(process.env.GITHUB_TOKEN || 'mock-token', context);
    this.mockFiles = mockFiles;
  }

  async getChangedFiles(): Promise<PullRequestFile[]> {
    logger.info(`[MOCK] Returning ${this.mockFiles.length} mock files`);
    return this.mockFiles;
  }

  async getPRDetails() {
    return {
      title: 'Test PR: Add new feature',
      body: 'This is a test PR for local development',
      author: 'test-user',
      baseRef: 'main',
      headRef: 'feature-branch',
    };
  }

  async createReview(comments: any[], body: string, event?: string): Promise<void> {
    logger.info('[MOCK] Creating PR review:');
    logger.info(`  Event: ${event || 'COMMENT'}`);
    logger.info(`  Comments: ${comments.length}`);
    logger.info(`  Body preview: ${body.substring(0, 200)}...`);
    
    // Write comments to file for inspection
    const fs = require('fs');
    const output = {
      event: event || 'COMMENT',
      body,
      comments: comments.map(c => ({
        path: c.path,
        line: c.line,
        body: c.body,
      })),
    };
    fs.writeFileSync('test-output.json', JSON.stringify(output, null, 2));
    logger.info('[MOCK] Review saved to test-output.json');
  }

  async postGeneralComment(body: string): Promise<void> {
    logger.info('[MOCK] Posting general comment:');
    logger.info(body.substring(0, 200) + '...');
  }
}

/**
 * Sample TypeScript code with intentional issues for testing
 */
const sampleTypeScriptCode = `
import { useState, useEffect } from 'react';

// Security issue: Hardcoded API key
const API_KEY = "sk-1234567890abcdef";

// Performance issue: Inefficient loop
function processData(items: any[]) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      if (items[i].id === items[j].id) {
        results.push(items[i]);
      }
    }
  }
  return results;
}

// Security issue: SQL injection vulnerability
function getUser(query: string) {
  const sql = "SELECT * FROM users WHERE name = '" + query + "'";
  return db.query(sql);
}

// Best practice issue: Missing error handling
async function fetchData(url: string) {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Maintainability issue: Magic numbers
function calculatePrice(quantity: number) {
  return quantity * 9.99 + 2.5;
}

export { processData, getUser, fetchData, calculatePrice };
`;

/**
 * Sample Python code with intentional issues for testing
 */
const samplePythonCode = `
import os
import pickle

# Security issue: Hardcoded secret
SECRET_KEY = "my-super-secret-key-12345"

# Security issue: Unsafe deserialization
def load_user_data(data):
    return pickle.loads(data)

# Performance issue: Inefficient string concatenation
def build_report(items):
    report = ""
    for item in items:
        report += str(item) + "\\n"
    return report

# Best practice issue: Bare except clause
def divide_numbers(a, b):
    try:
        return a / b
    except:
        return None

# Security issue: Command injection
def run_command(user_input):
    os.system("echo " + user_input)

if __name__ == "__main__":
    print("Hello World")
`;

/**
 * Create mock PR files for testing
 */
function createMockFiles(): PullRequestFile[] {
  return [
    {
      filename: 'src/utils/dataProcessor.ts',
      status: 'modified',
      additions: 45,
      deletions: 10,
      changes: 55,
      patch: `@@ -1,10 +1,45 @@
 import { useState, useEffect } from 'react';
 
+// Security issue: Hardcoded API key
+const API_KEY = "sk-1234567890abcdef";
+
+// Performance issue: Inefficient loop
+function processData(items: any[]) {
+  const results = [];
+  for (let i = 0; i < items.length; i++) {
+    for (let j = 0; j < items.length; j++) {
+      if (items[i].id === items[j].id) {
+        results.push(items[i]);
+      }
+    }
+  }
+  return results;
+}
+
+// Security issue: SQL injection vulnerability
+function getUser(query: string) {
+  const sql = "SELECT * FROM users WHERE name = '" + query + "'";
+  return db.query(sql);
+}
+
+// Best practice issue: Missing error handling
+async function fetchData(url: string) {
+  const response = await fetch(url);
+  const data = await response.json();
+  return data;
+}
+
 export { processData, getUser, fetchData };`,
      blob_url: 'https://github.com/test/blob/main/src/utils/dataProcessor.ts',
      raw_url: 'https://github.com/test/raw/main/src/utils/dataProcessor.ts',
    },
    {
      filename: 'backend/security.py',
      status: 'added',
      additions: 35,
      deletions: 0,
      changes: 35,
      patch: `@@ -0,0 +1,35 @@
+import os
+import pickle
n+
+# Security issue: Hardcoded secret
+SECRET_KEY = "my-super-secret-key-12345"
+
+# Security issue: Unsafe deserialization
+def load_user_data(data):
+    return pickle.loads(data)
+
+# Performance issue: Inefficient string concatenation
+def build_report(items):
+    report = ""
+    for item in items:
+        report += str(item) + "\\n"
+    return report
+
+# Best practice issue: Bare except clause
+def divide_numbers(a, b):
+    try:
+        return a / b
+    except:
+        return None
+
+# Security issue: Command injection
+def run_command(user_input):
+    os.system("echo " + user_input)`,
      blob_url: 'https://github.com/test/blob/main/backend/security.py',
      raw_url: 'https://github.com/test/raw/main/backend/security.py',
    },
    {
      filename: 'README.md',
      status: 'modified',
      additions: 5,
      deletions: 2,
      changes: 7,
      patch: `@@ -1,5 +1,8 @@
 # My Project
 
+## New Feature
+This adds awesome functionality!
+
 ## Installation
 \`\`\`bash
 npm install`,
      blob_url: 'https://github.com/test/blob/main/README.md',
      raw_url: 'https://github.com/test/raw/main/README.md',
    },
  ];
}

/**
 * Run the test
 */
async function runTest() {
  console.log('🚀 Starting local test of AI Code Review Action\n');

  // Check for required environment variables
  const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY or LLM_API_KEY environment variable is required');
    console.log('\nPlease set one of these environment variables:');
    console.log('  export OPENAI_API_KEY="your-api-key"');
    console.log('  export LLM_API_KEY="your-api-key"');
    console.log('\nOr create a .env file with:');
    console.log('  OPENAI_API_KEY=your-api-key');
    process.exit(1);
  }

  // Configuration
  const config: Config = {
    llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini', // Use mini for testing (cheaper)
    llmApiKey: apiKey,
    prompt: process.env.PROMPT || '', // Will use default
    githubToken: 'mock-token',
    reviewMode: (process.env.REVIEW_MODE as Config['reviewMode']) || 'detailed',
    maxFiles: parseInt(process.env.MAX_FILES || '10', 10),
    excludePatterns: ['*.md', '*.lock'],
    failOnError: false,
    postAsReview: true,
  };

  console.log('Configuration:');
  console.log(`  LLM Base URL: ${config.llmBaseUrl}`);
  console.log(`  LLM Model: ${config.llmModel}`);
  console.log(`  Review Mode: ${config.reviewMode}`);
  console.log(`  Max Files: ${config.maxFiles || 'unlimited'}`);
  console.log('');

  // Create mock context
  const context: GitHubContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    pullNumber: 1,
    commitId: 'abc123def456',
  };

  // Create mock files
  const mockFiles = createMockFiles();

  // Initialize clients
  const github = new MockGitHubClient(context, mockFiles);
  const llm = new LLMClient(config.llmApiKey, config.llmBaseUrl, config.llmModel);

  // Create orchestrator
  const orchestrator = new ReviewOrchestrator(config, github, llm);

  try {
    console.log('📝 Running code review...\n');
    const result = await orchestrator.runReview();

    console.log('\n✅ Test completed successfully!');
    console.log('\nResults:');
    console.log(`  Files Reviewed: ${result.filesReviewed}`);
    console.log(`  Total Comments: ${result.totalComments}`);
    console.log(`  Critical Issues: ${result.criticalIssues}`);
    console.log(`  Warnings: ${result.warnings}`);
    console.log(`  Suggestions: ${result.suggestions}`);
    console.log(`\nSummary: ${result.summary}`);

    if (result.totalComments > 0) {
      console.log('\n📄 Review details saved to: test-output.json');
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest();
