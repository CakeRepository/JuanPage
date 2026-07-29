/// <reference types="vite/client" />

interface JuanPagerConfig {
  basePath?: string;
  docsUrl?: string;
}

interface Window {
  JUANPAGER_CONFIG?: JuanPagerConfig;
}
