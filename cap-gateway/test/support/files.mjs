import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// samples/<name> or test/fixtures/<name>
export const readAlert = name =>
  readFileSync(
    join(ROOT, name.includes('/') ? name : name.startsWith('alert-') ? `samples/${name}` : `test/fixtures/${name}`),
    'utf-8'
  );
