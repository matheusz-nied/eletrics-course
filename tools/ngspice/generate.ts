/**
 * Runs every reference circuit in this folder through native ngspice and
 * writes src/engine/__golden__/<name>.csv (time or a single row, then one
 * column per vector). The CSVs are versioned, so CI never needs ngspice.
 *
 *   sudo apt install ngspice
 *   node tools/ngspice/generate.ts
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../src/engine/__golden__');

for (const file of readdirSync(here)
  .filter((f) => f.endsWith('.cir'))
  .sort()) {
  const work = mkdtempSync(join(tmpdir(), 'ngspice-'));
  try {
    copyFileSync(join(here, file), join(work, file));
    execFileSync('ngspice', ['-b', file], { cwd: work, stdio: 'pipe' });
    const rows = readFileSync(join(work, 'out.txt'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/));
    let [header, ...data] = rows;
    header = header.map((h) => h.toLowerCase());
    // An operating point has no scale: wrdata puts an arbitrary vector in its place.
    if (header[0] !== 'time') {
      header = ['op', ...header.slice(1)];
      data = data.map((row) => ['0', ...row.slice(1)]);
    }
    const csv = [
      header.join(','),
      ...data.map((row) => row.map((v) => Number(v).toString()).join(',')),
    ];
    const name = basename(file, '.cir');
    writeFileSync(join(out, `${name}.csv`), csv.join('\n') + '\n');
    console.log(`${name}: ${data.length} linhas, ${header.join(' ')}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
