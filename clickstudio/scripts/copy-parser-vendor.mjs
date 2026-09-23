import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(packageRoot, 'dist/vendor'), { recursive: true });
cpSync(
    resolve(packageRoot, 'vendor/clickhouse-parser'),
    resolve(packageRoot, 'dist/vendor/clickhouse-parser'),
    { recursive: true, force: true },
);
