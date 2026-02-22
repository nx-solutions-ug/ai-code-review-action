import * as github from '@actions/github';
import { PullRequestFile, ReviewComment, GitHubContext } from '../types';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retry';
import { minimatch } from 'minimatch';

export class GitHubClient {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context: GitHubContext;

  constructor(token: string, context: GitHubContext) {
    this.octokit = github.getOctokit(token);
    this.context = context;
  }

  /**
   * Get the current pull request context
   */
  static getContext(): GitHubContext | null {
    const context = github.context;
    
    if (!context.payload.pull_request) {
      return null;
    }

    return {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pullNumber: context.issue.number,
      commitId: context.payload.pull_request.head.sha,
    };
  }

  /**
   * Get the current commit SHA
   */
  async getCommitSha(): Promise<string> {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.context.owner,
      repo: this.context.repo,
      pull_number: this.context.pullNumber,
    });
    return pr.head.sha;
  }

  /**
   * Get list of changed files in the PR
   */
  async getChangedFiles(excludePatterns: string[]): Promise<PullRequestFile[]> {
    return logger.group('Fetching changed files', async () => {
      const files: PullRequestFile[] = [];

      // Use pagination to handle large PRs
      const iterator = this.octokit.paginate.iterator(
        this.octokit.rest.pulls.listFiles,
        {
          owner: this.context.owner,
          repo: this.context.repo,
          pull_number: this.context.pullNumber,
          per_page: 100,
        }
      );

      for await (const { data } of iterator) {
        files.push(...(data as PullRequestFile[]));
      }

      // Filter out excluded files
      const filteredFiles = files.filter(file => {
        const isExcluded = excludePatterns.some(pattern =>
          minimatch(file.filename, pattern, { matchBase: true })
        );
        
        if (isExcluded) {
          logger.info(`  Excluded: ${file.filename}`);
        }
        
        return !isExcluded;
      });

      logger.info(`Found ${filteredFiles.length} files to review (${files.length - filteredFiles.length} excluded)`);
      
      return filteredFiles;
    });
  }

  /**
   * Get the content of a file at a specific commit
   */
  async getFileContent(path: string, ref: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.context.owner,
        repo: this.context.repo,
        path,
        ref,
      });

      if ('content' in data && typeof data.content === 'string') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error) {
      logger.warning(`Failed to get content for ${path}: ${error}`);
      return null;
    }
  }

  /**
   * Create a formal PR review with comments
   */
  async createReview(
    comments: ReviewComment[],
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' = 'COMMENT'
  ): Promise<void> {
    if (comments.length === 0) {
      logger.info('No comments to post');
      return;
    }

    await logger.group(`Creating PR review with ${comments.length} comments`, async () => {
      const commitId = await this.getCommitSha();

      // GitHub has a limit of 65535 characters per review body
      const truncatedBody = body.length > 65000 
        ? body.substring(0, 65000) + '\n\n... (truncated)' 
        : body;

      await withRetry(
        () =>
          this.octokit.rest.pulls.createReview({
            owner: this.context.owner,
            repo: this.context.repo,
            pull_number: this.context.pullNumber,
            commit_id: commitId,
            body: truncatedBody,
            event,
            comments: comments.map(c => ({
              path: c.path,
              line: c.line,
              body: c.body,
              side: c.side || 'RIGHT',
              start_line: c.start_line,
              start_side: c.start_side,
            })),
          }),
        { maxAttempts: 3 }
      );

      logger.info(`Posted review with ${comments.length} comments`);
    });
  }

  /**
   * Post individual review comments (not as a formal review)
   */
  async postReviewComments(comments: ReviewComment[]): Promise<void> {
    if (comments.length === 0) {
      logger.info('No comments to post');
      return;
    }

    await logger.group(`Posting ${comments.length} review comments`, async () => {
      const commitId = await this.getCommitSha();

      for (const comment of comments) {
        try {
          await withRetry(
            () =>
              this.octokit.rest.pulls.createReviewComment({
                owner: this.context.owner,
                repo: this.context.repo,
                pull_number: this.context.pullNumber,
                commit_id: commitId,
                path: comment.path,
                line: comment.line,
                body: comment.body,
                side: comment.side || 'RIGHT',
                start_line: comment.start_line,
                start_side: comment.start_side,
              }),
            { maxAttempts: 3 }
          );

          logger.info(`  Posted comment on ${comment.path}:${comment.line}`);
        } catch (error) {
          logger.warning(
            `  Failed to post comment on ${comment.path}:${comment.line}: ${error}`
          );
        }
      }
    });
  }

  /**
   * Post a general PR comment (not tied to specific lines)
   */
  async postGeneralComment(body: string): Promise<void> {
    await logger.group('Posting general PR comment', async () => {
      // GitHub has a limit of 65535 characters per comment
      const truncatedBody = body.length > 65000 
        ? body.substring(0, 65000) + '\n\n... (truncated)' 
        : body;

      await withRetry(
        () =>
          this.octokit.rest.issues.createComment({
            owner: this.context.owner,
            repo: this.context.repo,
            issue_number: this.context.pullNumber,
            body: truncatedBody,
          }),
        { maxAttempts: 3 }
      );

      logger.info('Posted general comment');
    });
  }

  /**
   * Update an existing comment
   */
  async updateComment(commentId: number, body: string): Promise<void> {
    await withRetry(
      () =>
        this.octokit.rest.issues.updateComment({
          owner: this.context.owner,
          repo: this.context.repo,
          comment_id: commentId,
          body,
        }),
      { maxAttempts: 3 }
    );
  }

  /**
   * Find existing bot comments
   */
  async findExistingComments(botUsername: string): Promise<Array<{ id: number; body: string }>> {
    const { data: comments } = await this.octokit.rest.issues.listComments({
      owner: this.context.owner,
      repo: this.context.repo,
      issue_number: this.context.pullNumber,
    });

    return comments
      .filter(comment => comment.user?.login === botUsername)
      .map(comment => ({
        id: comment.id,
        body: comment.body || '',
      }));
  }

  /**
   * Get PR details
   */
  async getPRDetails(): Promise<{
    title: string;
    body: string | null;
    author: string;
    baseRef: string;
    headRef: string;
  }> {
    const { data: pr } = await this.octokit.rest.pulls.get({
      owner: this.context.owner,
      repo: this.context.repo,
      pull_number: this.context.pullNumber,
    });

    return {
      title: pr.title,
      body: pr.body,
      author: pr.user?.login || 'unknown',
      baseRef: pr.base.ref,
      headRef: pr.head.ref,
    };
  }
}
