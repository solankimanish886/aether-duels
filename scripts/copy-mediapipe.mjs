// Copies the MediaPipe tasks-vision WASM fileset out of the INSTALLED npm package
// into public/mediapipe/wasm so it is served same-origin. This keeps the WASM binary
// and the JS glue at exactly the same version (both come from one `npm install`),
// which is required by MediaPipe — a mismatch silently breaks hand detection. Runs
// automatically via the `predev`/`prebuild` npm hooks (and on Vercel's build).
import { cp, mkdir, access, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const destDir = resolve(root, 'public/mediapipe/wasm');

try {
  await access(srcDir);
} catch {
  console.error(
    `[copy-mediapipe] Source not found: ${srcDir}\n` +
      `Run "npm install" first so @mediapipe/tasks-vision is available.`,
  );
  process.exit(1);
}

await mkdir(destDir, { recursive: true });
await cp(srcDir, destDir, { recursive: true });

const files = await readdir(destDir);
console.log(`[copy-mediapipe] Copied ${files.length} files to public/mediapipe/wasm`);
