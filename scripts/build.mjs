// Builds the site for GitHub Pages into _site/ (or the folder given as the
// first argument): copies the app files and writes precache.js, the list of
// files the service worker keeps for offline use. The cache version is a
// hash of all files, so every change reaches users as an update.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'webapp');
const out = process.argv[2] ? resolve(process.argv[2]) : join(root, '_site');
const PUBLIC = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

function filesIn(path) {
  return statSync(path).isDirectory() ? readdirSync(path).flatMap((name) => filesIn(join(path, name))) : [path];
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
PUBLIC.forEach((name) => cpSync(join(src, name), join(out, name), { recursive: true }));

const files = PUBLIC.flatMap((name) => filesIn(join(out, name)))
  .map((p) => relative(out, p).split(sep).join('/'))
  .filter((p) => p !== 'sw.js' && !p.endsWith('.DS_Store'))
  .sort();
const hash = createHash('sha256');
files.forEach((f) => hash.update(f).update(readFileSync(join(out, f))));
const version = hash.digest('hex').slice(0, 12);
const precache = { version, files: ['./', ...files] };
writeFileSync(join(out, 'precache.js'), `self.PRECACHE = ${JSON.stringify(precache, null, 2)};\n`);
console.log(`built ${out}: ${files.length} files, cache version ${version}`);
