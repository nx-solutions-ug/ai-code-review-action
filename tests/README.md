# Testing Guide

This directory contains tests for the AI Code Review Action.

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Local Integration Testing

You can test the action locally without needing a real GitHub PR:

#### 1. Setup Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
nano .env
```

#### 2. Run Local Test

```bash
# Run with default settings (detailed review mode)
npm run test:local

# Run in security mode
npm run test:local:security

# Run in performance mode
npm run test:local:performance

# Run with custom settings
REVIEW_MODE=security LLM_MODEL=gpt-4o npm run test:local
```

#### 3. View Results

After running, check:
- Console output for review summary
- `test-output.json` for detailed review comments

### Test Scenarios

The local test includes mock files with intentional issues:

1. **TypeScript file** (`src/utils/dataProcessor.ts`):
   - Hardcoded API key (security)
   - Inefficient O(n²) loop (performance)
   - SQL injection vulnerability (security)
   - Missing error handling (best practice)

2. **Python file** (`backend/security.py`):
   - Hardcoded secret (security)
   - Unsafe pickle deserialization (security)
   - Inefficient string concatenation (performance)
   - Bare except clause (best practice)
   - Command injection (security)

3. **Markdown file** (`README.md`):
   - Should be excluded based on default patterns

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ | - | Your OpenAI API key |
| `LLM_BASE_URL` | ❌ | `https://api.openai.com/v1` | LLM API endpoint |
| `LLM_MODEL` | ❌ | `gpt-4o-mini` | Model to use |
| `REVIEW_MODE` | ❌ | `detailed` | Review mode |
| `MAX_FILES` | ❌ | `10` | Max files to review |
| `PROMPT` | ❌ | - | Custom prompt |

### Using Different LLM Providers

#### OpenAI
```bash
export OPENAI_API_KEY="sk-..."
export LLM_MODEL="gpt-4o"
npm run test:local
```

#### Anthropic Claude
```bash
export OPENAI_API_KEY="sk-ant-..."
export LLM_BASE_URL="https://api.anthropic.com/v1"
export LLM_MODEL="claude-3-5-sonnet-20241022"
npm run test:local
```

#### Ollama (Local)
```bash
# Start Ollama first
ollama run codellama

# Then run test
export OPENAI_API_KEY="ollama"
export LLM_BASE_URL="http://localhost:11434/v1"
export LLM_MODEL="codellama"
npm run test:local
```

#### Azure OpenAI
```bash
export OPENAI_API_KEY="your-azure-key"
export LLM_BASE_URL="https://your-resource.openai.azure.com/openai/deployments/your-deployment"
export LLM_MODEL="gpt-4"
npm run test:local
```

### Testing with Act

To test the actual GitHub Actions workflow locally:

```bash
# Install act if not already installed
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Create a test event
cat > .github/test-event.json << 'EOF'
{
  "pull_request": {
    "number": 1,
    "head": {
      "sha": "abc123"
    }
  }
}
EOF

# Run the workflow locally
act pull_request -e .github/test-event.json --secret OPENAI_API_KEY=$OPENAI_API_KEY
```

### Debugging

Enable debug logging:

```bash
# Set debug flag
export DEBUG=true

# Run test
npm run test:local
```

### Adding New Test Cases

To add new test scenarios:

1. Edit `tests/manual-test.ts`
2. Add new mock files to `createMockFiles()`
3. Include intentional issues for the LLM to detect
4. Run the test and verify the LLM catches the issues

Example:

```typescript
{
  filename: 'src/new-feature.ts',
  status: 'added',
  additions: 20,
  deletions: 0,
  changes: 20,
  patch: `@@ -0,0 +1,20 @@
+// Your code with intentional issues here`,
  blob_url: '...',
  raw_url: '...',
}
```

## CI/CD Testing

The action includes GitHub Actions workflows for testing:

- `.github/workflows/ci.yml` - Runs on every PR
- `.github/workflows/release.yml` - Runs on releases

Make sure all tests pass before publishing a new version.
