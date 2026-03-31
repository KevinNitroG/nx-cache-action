# nx-cache-action

A GitHub Actions cache proxy server for [Nx self-hosted remote caching](https://nx.dev/docs/guides/tasks--caching/self-hosted-caching).

This package bridges GitHub Actions' built-in cache system with Nx's remote cache API, allowing you to leverage GitHub Actions cache in CI without requiring an external cache server.

## Installation

Install along with your project, into dev deps or globally, or use it with `npx`/`pnpm dlx` without installing

```bash
# pnpm
pnpm add -D -w @kevinnitro/nx-cache-action

# mise
mise use npm:@kevinnitro/nx-cache-action
```

## Usage

Use it as a wrapper around your Nx commands in GitHub Actions:

```yaml
- name: Run Nx with cache proxy
  run: pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx build
```

The tool automatically:

1. Starts a local cache server on port 3000
2. Sets `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` environment variable
3. Executes your Nx command
4. Cleans up and shuts down the server after the command completes

## Examples

### Basic usage with Nx CLI

```bash
pnpm dlx @kevinnitro/nx-cache-action -- nx build
```

### Run multiple targets

```bash
pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t lint build test
```

### GitHub Actions workflow example

```yaml
name: Build and Test

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Build with Nx cache
        run: pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t build

      - name: Test with Nx cache
        run: pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t test
```

## Configuration

### Environment Variables

- `NX_CACHE_ACTION_PORT` - Cache server port (default: `3000`)
- `NX_CACHE_ACTION_SKIP_UPLOAD_CACHE` - Skip uploading to cache if set to `'true'` (default: `false`)
- `NX_CACHE_ACTION_CACHE_KEY_PREFIX` - Prefix for cache keys (default: `'nx-'`)
- `NX_CACHE_ACTION_CLEANUP_CACHE` - Clean up local cache files after operation, set to `'false'` to disable (default: `'true'`)
- `RUNNER_ID` - GitHub Actions runner ID for cache directory naming (automatically set by GitHub Actions)

### CLI Options

- `--help, -h` - Show help message
- `--no-cleanup-cache` - Disable automatic cache cleanup after operation

## How It Works

1. **Proxy Server**: Starts an Express server that implements the [Nx remote cache OpenAPI specification](https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#open-api-specification)
2. **GitHub Actions Cache Integration**: Uses `@actions/cache` to store/retrieve artifacts from GitHub Actions
3. **Process Spawning**: Spawns your Nx command with the cache server URL injected as `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`
4. **Environment Cleanup**: Strips GitHub Actions-specific environment variables (`ACTIONS_*`) before spawning the child process

## Requirements

- Node.js 18+ (idk the AI said about this, but I guess it is not matter)
- GitHub Actions environment (uses `@actions/cache` under the hood)
