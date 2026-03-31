declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NX_CACHE_ACTION_PORT?: string;
      NX_CACHE_ACTION_SKIP_UPLOAD_CACHE?: string;
      NX_CACHE_ACTION_CACHE_KEY_PREFIX?: string;
      NX_CACHE_ACTION_CLEANUP_CACHE?: string;
      RUNNER_ID?: string;
    }
  }
}

export {};
