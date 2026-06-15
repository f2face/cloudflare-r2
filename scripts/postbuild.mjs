import { writeFileSync } from 'node:fs';

writeFileSync('lib/cjs/package.json', JSON.stringify({ type: 'commonjs' }) + '\n');
writeFileSync('lib/esm/package.json', JSON.stringify({ type: 'module' }) + '\n');
