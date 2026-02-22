import * as core from '@actions/core';
import { loadConfig } from './config';
import { GitHubClient } from './github/client';
import { LLMClient } from './llm/client';
import { ReviewOrchestrator } from './review/orchestrator';
import { logger } from './utils/logger';

/**
 * Main entry point for the GitHub Action
 */
async function run(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfig();

    // Get GitHub context
    const context = GitHubClient.getContext();
    if (!context) {
      throw new Error(
        'This action can only be run on pull requests. ' +
        'Make sure your workflow triggers on pull_request events.'
      );
    }

    logger.info(`Processing PR #${context.pullNumber} in ${context.owner}/${context.repo}`);

    // Initialize clients
    const github = new GitHubClient(config.githubToken, context);
    const llm = new LLMClient(
      config.llmApiKey,
      config.llmBaseUrl,
      config.llmModel
    );

    // Run review
    const orchestrator = new ReviewOrchestrator(config, github, llm);
    const result = await orchestrator.runReview();

    // Set outputs
    core.setOutput('review-summary', result.summary);
    core.setOutput('files-reviewed', result.filesReviewed.toString());
    core.setOutput('comments-posted', result.totalComments.toString());
    core.setOutput('status', 'success');

    logger.info('✅ Code review completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`❌ Code review failed: ${errorMessage}`);
    
    // Set outputs even on failure
    core.setOutput('review-summary', `Review failed: ${errorMessage}`);
    core.setOutput('files-reviewed', '0');
    core.setOutput('comments-posted', '0');
    core.setOutput('status', 'failed');

    // Optionally fail the workflow
    // Try to get failOnError from config, default to false if config loading fails
    let shouldFail = false;
    try {
      const errorConfig = loadConfig();
      shouldFail = errorConfig.failOnError;
    } catch {
      // If config loading fails, default to not failing
      shouldFail = false;
    }
    
    if (shouldFail) {
      core.setFailed(errorMessage);
    }
  }
}

// Run the action
run();
