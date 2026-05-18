#!/usr/bin/env node
/**
 * Build the O-Control service as a standalone macOS binary using @yao-pkg/pkg
 * and place it in the Tauri binaries directory with the correct target-triple name.
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

// ── 2. Package with pkg ─────────────────────────────────────────
console.log('→ Packaging with pkg...');
const pkgOutput = path.join(distDir, 'o-control-service');

// Determine the correct pkg target for this machine
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const pkgTarget = `node20-macos-${arch}`;

execSync(
  `npx -y @yao-pkg/pkg "${path.join(distDir, 'bundle.cjs')}" --target ${pkgTarget} --output "${pkgOutput}"`,
  { cwd: __dirname, stdio: 'inherit' },
);

if (!fs.existsSync(pkgOutput)) {
  console.error('✗ pkg binary not found at', pkgOutput);
  process.exit(1);
}
console.log('  ✓ Binary packaged');

// ── 3. Ad-hoc sign ──────────────────────────────────────────────
console.log('→ Signing binary...');
fs.chmodSync(pkgOutput, 0o755);
try {
  execSync(`codesign --sign - --force "${pkgOutput}"`, { stdio: 'inherit' });
} catch {
  console.warn('⚠ codesign failed (non-fatal on dev machines without Xcode CLI)');
}

// ── 4. Copy to Tauri binaries directory ─────────────────────────
const targetTriple = execSync('rustc --print host-tuple').toString().trim();
if (!targetTriple) {
  console.error('✗ Could not determine Rust target triple');
  process.exit(1);
}

fs.mkdirSync(binariesDir, { recursive: true });
const destPath = path.join(binariesDir, `o-control-service-${targetTriple}`);
fs.copyFileSync(pkgOutput, destPath);
fs.chmodSync(destPath, 0o755);

console.log(`✓ Sidecar ready: ${destPath}`);
console.log(`  Target triple: ${targetTriple}`);
console.log(`  Size: ${(fs.statSync(destPath).size / 1024 / 1024).toFixed(1)} MB`);
