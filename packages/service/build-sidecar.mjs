#!/usr/bin/env node
/**
 * Build the O-Control service for the Apple Silicon desktop bundle.
 *
 * The sidecar is shipped as the current esbuild bundle plus a private Bun
 * runtime. This avoids @yao-pkg/pkg falling back to a many-minute Node source
 * compilation when an arm64 runtime is not available in its cache.
 *
 * Usage: node build-sidecar.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const tauriDir = path.resolve(__dirname, '../../apps/desktop/src-tauri');
const binariesDir = path.join(tauriDir, 'binaries');
const resourcesDir = path.join(tauriDir, 'resources');

// ── 1. Bundle with esbuild ──────────────────────────────────────
console.log('→ Bundling service with esbuild...');
fs.mkdirSync(distDir, { recursive: true });

// Build as CJS (pkg requires CJS).
await esbuild.build({
  entryPoints: [path.join(__dirname, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: path.join(distDir, 'bundle.cjs'),
});

console.log('  ✓ Bundle created');

// O-Control is currently distributed for Apple Silicon only.
// Fail early on another host instead of silently producing an Intel sidecar.
if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error(
    `Apple Silicon macOS build required (darwin/arm64); got ${process.platform}/${process.arch}`,
  );
}

// ── 2. Stage the Bun runtime and service bundle as Tauri resources ─
console.log('→ Staging Bun runtime and service bundle...');
const bunPath = process.env.BUN_RUNTIME || execSync('command -v bun', { encoding: 'utf8' }).trim();
if (!bunPath || !fs.existsSync(bunPath)) {
  throw new Error('Bun runtime not found. Install Bun or set BUN_RUNTIME=/path/to/bun.');
}

fs.mkdirSync(resourcesDir, { recursive: true });
const runtimeDest = path.join(resourcesDir, 'o-control-service-bun');
const bundleDest = path.join(resourcesDir, 'o-control-service.cjs');
fs.copyFileSync(bunPath, runtimeDest);
fs.copyFileSync(path.join(distDir, 'bundle.cjs'), bundleDest);
fs.chmodSync(runtimeDest, 0o755);
fs.chmodSync(bundleDest, 0o644);

// ── 3. Create the target-triple sidecar launcher ─────────────────
const targetTriple = 'aarch64-apple-darwin';

fs.mkdirSync(binariesDir, { recursive: true });
const destPath = path.join(binariesDir, `o-control-service-${targetTriple}`);
const launcher = `#!/bin/sh
set -eu
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
RESOURCE_DIR="$SCRIPT_DIR/../Resources"
if [ -x "$RESOURCE_DIR/o-control-service-bun" ]; then
  BUN_RUNTIME="$RESOURCE_DIR/o-control-service-bun"
else
  BUN_RUNTIME="$RESOURCE_DIR/resources/o-control-service-bun"
fi
if [ -f "$RESOURCE_DIR/o-control-service.cjs" ]; then
  SERVICE_BUNDLE="$RESOURCE_DIR/o-control-service.cjs"
else
  SERVICE_BUNDLE="$RESOURCE_DIR/resources/o-control-service.cjs"
fi
exec "$BUN_RUNTIME" "$SERVICE_BUNDLE" "$@"
`;
fs.writeFileSync(destPath, launcher, 'utf8');
fs.chmodSync(destPath, 0o755);

console.log(`✓ Sidecar ready: ${destPath}`);
console.log(`  Target triple: ${targetTriple}`);
console.log(`  Bun runtime: ${(fs.statSync(runtimeDest).size / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Service bundle: ${(fs.statSync(bundleDest).size / 1024 / 1024).toFixed(1)} MB`);
