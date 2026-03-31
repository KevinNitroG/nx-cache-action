# nx-cache-action

GitHub Actions cache proxy for [Nx self-hosted remote caching](https://nx.dev/docs/guides/tasks--caching/self-hosted-caching).

Bridges GitHub Actions cache with Nx's self hosted remote cache API

## Installation

```bash
pnpm dlx @kevinnitro/nx-cache-action -- <command>

# or install locally
pnpm add -D @kevinnitro/nx-cache-action

# mise
mise use npm:@kevinnitro/nx-cache-action --pin
```

## Quick Start

Add to your GitHub Actions workflow:

```yaml
- uses: crazy-max/ghaction-github-runtime@v4 # Must!

- run: pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t build
```

**Important:** The `--` separator is required before your command. Everything after `--` is passed to your Nx command.

The tool:

1. Starts a local cache server
2. Sets `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` automatically
3. Executes your command with cache support
4. Cleans up and shuts down when done

## Examples

```bash
pnpm dlx @kevinnitro/nx-cache-action -- nx build

pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t build test

pnpm dlx @kevinnitro/nx-cache-action --no-cleanup-cache -- nx build

NX_CACHE_ACTION_PORT=4000 pnpm dlx @kevinnitro/nx-cache-action -- nx build
```

### Complete GitHub Actions workflow

```yaml
name: Build and Test

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: crazy-max/ghaction-github-runtime@v4
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v6
        with:
          node-version: 25.7.0
          cache: pnpm

      - run: pnpm install
      - run: pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t build
      - run: pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t test
```

## Configuration

### CLI Options

- `--help, -h` - Show help message
- `--no-cleanup-cache` - Disable automatic cache file cleanup

### Environment Variables

- `NX_CACHE_ACTION_PORT` - Cache server port (default: `3000`)
- `NX_CACHE_ACTION_SKIP_UPLOAD_CACHE` - Skip uploads when `'true'` (default: `false`)
- `NX_CACHE_ACTION_CACHE_KEY_PREFIX` - Cache key prefix (default: `'nx-'`)
- `NX_CACHE_ACTION_CLEANUP_CACHE` - Cleanup cache files when not `'false'` (default: `'true'`)

## How It Works

1. Starts an Express server implementing [Nx remote cache OpenAPI spec](https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#open-api-specification)
2. Uses `@actions/cache` to store/retrieve artifacts from GitHub Actions
3. Injects `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` into spawned command
4. Cleans up cache files after operation (configurable)
5. Strips `ACTIONS_*` environment variables before spawning process

## Notes

- Requires `crazy-max/ghaction-github-runtime@v4` to expose GitHub runtime
- The `--` separator is mandatory before your command
- Cache cleanup is enabled by default for space efficiency

## Migration from nx

This package replaces the deprecated [raegen/nx](https://github.com/raegen/nx) action (which used [@NiklasPor/nx-remotecache-custom](https://github.com/NiklasPor/nx-remotecache-custom) internally) with an official way of integrating Nx self-hosted remote caching
