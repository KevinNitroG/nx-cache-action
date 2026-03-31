#!/usr/bin/env node
import { spawn } from 'child_process';
import * as core from '@actions/core';
import minimist from 'minimist';
import { createServer, getServerConfig } from './server.js';

function printUsage(): void {
  const usage = `
Usage: pnpm dlx @kevinnitro/nx-cache-action [options] -- <command> [args...]

Description:
  Proxy server for GitHub Actions cache to use with Nx remote cache.
  This tool starts a local cache server and executes the provided command
  with the NX_SELF_HOSTED_REMOTE_CACHE_SERVER environment variable set.

Options:
  --help, -h                    Show this help message
  --no-cleanup-cache            Disable automatic cleanup of cache files after operation

Environment Variables:
  NX_CACHE_ACTION_PORT                  Port for the cache server (default: 3000)
  NX_CACHE_ACTION_SKIP_UPLOAD_CACHE     Skip cache uploads if set to 'true'
  NX_CACHE_ACTION_CACHE_KEY_PREFIX      Prefix for cache keys (default: 'nx-')
  NX_CACHE_ACTION_CLEANUP_CACHE         Set to 'false' to disable cleanup (default: 'true')
  RUNNER_ID                             Runner ID for cache directory naming (default: 'default')

Examples:
  pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx build my-app
  pnpm dlx @kevinnitro/nx-cache-action -- pnpm exec nx run-many -t build test
  NX_CACHE_ACTION_PORT=4000 pnpm dlx @kevinnitro/nx-cache-action -- nx build
  pnpm dlx @kevinnitro/nx-cache-action --no-cleanup-cache -- nx build
  NX_CACHE_ACTION_CLEANUP_CACHE=false pnpm dlx @kevinnitro/nx-cache-action -- nx build
`;
  core.info(usage);
}

function stripActionsEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cleanEnv: NodeJS.ProcessEnv = {};
  for (const key in env) {
    if (!key.startsWith('ACTIONS_')) {
      cleanEnv[key] = env[key];
    }
  }
  return cleanEnv;
}

function main(): void {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['help', 'no-cleanup-cache'],
    alias: { h: 'help' },
    '--': true,
  });

  if (argv.help) {
    printUsage();
    process.exit(0);
  }

  if (argv['no-cleanup-cache']) {
    process.env.NX_CACHE_ACTION_CLEANUP_CACHE = 'false';
  }

  const command = argv['--'];

  if (!command || command.length === 0) {
    core.error('No command provided after --');
    printUsage();
    process.exit(1);
  }

  const [cmd, ...cmdArgs] = command;

  if (!cmd) {
    core.error('Invalid command');
    printUsage();
    process.exit(1);
  }

  const config = getServerConfig();
  const server = createServer(config);

  const cleanEnv = stripActionsEnv(process.env);

  const child = spawn(cmd, cmdArgs, {
    env: {
      ...cleanEnv,
      NX_SELF_HOSTED_REMOTE_CACHE_SERVER: `http://localhost:${config.port}`,
    },
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code: number | null) => {
    core.info(`Command exited with code ${code ?? 1}. Shutting down server.`);
    server.close();
    process.exit(code ?? 1);
  });

  child.on('error', (err: Error) => {
    core.error(`Failed to start command: ${err.message}`);
    server.close();
    process.exit(1);
  });

  process.on('SIGINT', () => {
    core.warning('Received SIGINT, shutting down...');
    child.kill('SIGINT');
    server.close();
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    core.warning('Received SIGTERM, shutting down...');
    child.kill('SIGTERM');
    server.close();
    process.exit(143);
  });
}

main();
