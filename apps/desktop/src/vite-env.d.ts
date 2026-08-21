/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCREENSHOT_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
