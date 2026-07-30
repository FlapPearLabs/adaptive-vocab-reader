// esbuild 构建脚本：将 TypeScript 源码打包为 Chrome MV3 扩展产物
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, 'extension');
const DIST_DIR = resolve(__dirname, 'dist');
const SRC_DIR = resolve(EXT_DIR, 'src');

const isProd = process.env.NODE_ENV === 'production';

// 确保输出目录存在
mkdirSync(DIST_DIR, { recursive: true });

async function build() {
  // 构建 content script
  await esbuild.build({
    entryPoints: [resolve(SRC_DIR, 'content/index.ts')],
    bundle: true,
    outfile: resolve(DIST_DIR, 'content.js'),
    target: 'es2022',
    format: 'iife',
    platform: 'browser',
    minify: isProd,
    sourcemap: !isProd ? 'inline' : false,
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    },
  });

  // 构建 service worker
  await esbuild.build({
    entryPoints: [resolve(SRC_DIR, 'worker/index.ts')],
    bundle: true,
    outfile: resolve(DIST_DIR, 'worker.js'),
    target: 'es2022',
    format: 'iife',
    platform: 'browser',
    minify: isProd,
    sourcemap: !isProd ? 'inline' : false,
  });

  // 构建弹窗（首测入口）
  await esbuild.build({
    entryPoints: [resolve(SRC_DIR, 'popup.ts')],
    bundle: true,
    outfile: resolve(DIST_DIR, 'popup.js'),
    target: 'es2022',
    format: 'iife',
    platform: 'browser',
    minify: isProd,
    sourcemap: !isProd ? 'inline' : false,
  });

  // 复制弹窗静态资源
  cpSync(resolve(EXT_DIR, 'popup.html'), resolve(DIST_DIR, 'popup.html'));
  cpSync(resolve(EXT_DIR, 'popup.css'), resolve(DIST_DIR, 'popup.css'));

  // 复制 manifest
  const manifest = JSON.parse(readFileSync(resolve(EXT_DIR, 'manifest.json'), 'utf-8'));
  writeFileSync(resolve(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // 复制 data 目录
  cpSync(resolve(EXT_DIR, 'data'), resolve(DIST_DIR, 'data'), { recursive: true });

  console.log('✅ Build complete:', DIST_DIR);
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
