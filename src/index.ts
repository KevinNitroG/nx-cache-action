import express, { type Request, type Response } from 'express';
import * as cache from '@actions/cache';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);
const SKIP_UPLOAD_CACHE: boolean = process.env.SKIP_UPLOAD_CACHE === 'true';
const CACHE_KEY_PREFIX: string = process.env.CACHE_KEY_PREFIX || 'nx-';
const RUNNER_ID: string = process.env.GITHUB_RUN_ID || 'default';
const CACHE_DIR: string = path.join(os.tmpdir(), `nx-gh-cache-${RUNNER_ID}`);

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

app.get(
  '/v1/cache/:hash',
  async (req: Request, res: Response): Promise<void> => {
    const hash = req.params.hash as string;
    const cacheKey: string = `${CACHE_KEY_PREFIX}${hash}`;
    const filePath: string = path.join(CACHE_DIR, `${hash}.bin`);

    try {
      const restoredKey: string | undefined = await cache.restoreCache(
        [filePath],
        cacheKey,
      );

      if (!restoredKey) {
        res.status(404).send('Cache artifact not found');
        return;
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      const readStream = fs.createReadStream(filePath);

      readStream.pipe(res);

      readStream.on('error', (err: Error) => {
        console.error(`[Cache GET] Error streaming file: ${err.message}`);
        if (!res.headersSent) res.status(500).send('Stream error');
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[Cache GET] Error: ${errorMessage}`);
      res.status(500).send(errorMessage);
    }
  },
);

app.put('/v1/cache/:hash', (req: Request, res: Response): void => {
  if (SKIP_UPLOAD_CACHE) {
    console.log(
      '[Cache PUT] Skipping cache upload due to SKIP_UPLOAD_CACHE=true',
    );
    res.status(200).send('Cache upload skipped');
    return;
  }
  const hash = req.params.hash as string;
  const cacheKey: string = `${CACHE_KEY_PREFIX}${hash}`;
  const filePath: string = path.join(CACHE_DIR, `${hash}.bin`);

  const writeStream = fs.createWriteStream(filePath);

  req.pipe(writeStream);

  req.on('end', async () => {
    try {
      await cache.saveCache([filePath], cacheKey);

      res.status(200).send('Successfully uploaded the output');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[Cache PUT] Error saving cache: ${errorMessage}`);
      res.status(500).send(errorMessage);
    }
  });

  req.on('error', (err: Error) => {
    console.error(`[Cache PUT] Request stream error: ${err.message}`);
    res.status(500).send('Stream error');
  });
});

const server = app.listen(PORT, () => {
  console.log(`[Cache Server] Running on http://localhost:${PORT}`);

  const args: string[] = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      'No command provided. Usage: pnpm dlx @kevinnitro/nx-cache-action <normal nx command>',
      'e.g., pnpm dlx @kevinnitro/nx-cache-action pnpm exec nx build my-app',
    );
    server.close();
    process.exit(1);
  }

  const [command, ...commandArgs] = args;

  if (!command) {
    console.error('No command provided. Exiting.');
    server.close();
    process.exit(1);
  }
  const child = spawn(command, commandArgs, {
    env: {
      ...process.env,
      NX_SELF_HOSTED_REMOTE_CACHE_SERVER: `http://localhost:${PORT}`,
    },
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code: number | null) => {
    console.log(
      `[Cache Server] Command exited with code ${code}. Shutting down server.`,
    );
    server.close();

    process.exit(code ?? 1);
  });
});
