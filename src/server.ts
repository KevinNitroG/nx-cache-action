import express, { type Request, type Response } from 'express';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ServerConfig {
  port: number;
  skipUploadCache: boolean;
  cacheKeyPrefix: string;
  cacheDir: string;
  cleanupCacheAfterOperation: boolean;
}

export function createServer(config: ServerConfig) {
  const app = express();

  if (!fs.existsSync(config.cacheDir)) {
    fs.mkdirSync(config.cacheDir, { recursive: true });
  }

  app.get('/v1/cache/:hash', async (req: Request, res: Response): Promise<void> => {
    const hash = req.params.hash as string;
    const cacheKey: string = `${config.cacheKeyPrefix}${hash}`;
    const filePath: string = path.join(config.cacheDir, `${hash}.bin`);

    try {
      const restoredKey: string | undefined = await cache.restoreCache([filePath], cacheKey);

      if (!restoredKey) {
        res.status(404).send('The record was not found');
        return;
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      const readStream = fs.createReadStream(filePath);

      readStream.pipe(res);

      readStream.on('end', () => {
        if (config.cleanupCacheAfterOperation) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              core.debug(`Cleaned up cache file: ${filePath}`);
            }
          } catch (cleanupErr: unknown) {
            const cleanupMessage = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
            core.warning(`Failed to cleanup cache file: ${cleanupMessage}`);
          }
        }
      });

      readStream.on('error', (err: Error) => {
        core.error(`Error streaming file: ${err.message}`);
        if (!res.headersSent) res.status(500).send('Stream error');
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      core.error(`Cache GET error: ${errorMessage}`);
      res.status(500).send(errorMessage);
    }
  });

  app.put('/v1/cache/:hash', (req: Request, res: Response): void => {
    if (config.skipUploadCache) {
      core.info('Skipping cache upload due to NX_CACHE_ACTION_SKIP_UPLOAD_CACHE=true');
      res.status(200).send('Cache upload skipped');
      return;
    }

    const hash = req.params.hash as string;
    const cacheKey: string = `${config.cacheKeyPrefix}${hash}`;
    const filePath: string = path.join(config.cacheDir, `${hash}.bin`);

    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    req.on('end', async () => {
      try {
        await cache.saveCache([filePath], cacheKey);

        if (config.cleanupCacheAfterOperation) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              core.debug(`Cleaned up cache file: ${filePath}`);
            }
          } catch (cleanupErr: unknown) {
            const cleanupMessage = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
            core.warning(`Failed to cleanup cache file: ${cleanupMessage}`);
          }
        }

        res.status(200).send('Successfully uploaded the output');
      } catch (error: unknown) {
        if (error instanceof cache.ReserveCacheError) {
          core.warning(`Cache already exists or is being created: ${error.message}`);
          res.status(409).send('Cannot override an existing record');
        } else if (error instanceof cache.ValidationError) {
          core.error(`Validation error: ${error.message}`);
          res.status(400).send(error.message);
        } else {
          const errorMessage = error instanceof Error ? error.message : String(error);
          core.error(`Error saving cache: ${errorMessage}`);
          res.status(500).send(errorMessage);
        }
      }
    });

    req.on('error', (err: Error) => {
      core.error(`Request stream error: ${err.message}`);
      res.status(500).send('Stream error');
    });
  });

  return app.listen(config.port, () => {
    core.info(`Cache server running on http://localhost:${config.port}`);
  });
}

export function getServerConfig(): ServerConfig {
  const port: number = parseInt(process.env.NX_CACHE_ACTION_PORT || '3000', 10);
  const skipUploadCache: boolean = process.env.NX_CACHE_ACTION_SKIP_UPLOAD_CACHE === 'true';
  const cacheKeyPrefix: string = process.env.NX_CACHE_ACTION_CACHE_KEY_PREFIX || 'nx-';
  const cleanupCacheAfterOperation: boolean = process.env.NX_CACHE_ACTION_CLEANUP_CACHE !== 'false';
  const runnerId: string = process.env.RUNNER_ID || 'default';
  const cacheDir: string = path.join(os.tmpdir(), `nx-gh-cache-${runnerId}`);

  return {
    port,
    skipUploadCache,
    cacheKeyPrefix,
    cacheDir,
    cleanupCacheAfterOperation,
  };
}
