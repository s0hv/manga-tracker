import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const source = path.resolve(__dirname, '..', 'dist');
const dest = path.resolve(__dirname, '..', 'instrumented');
fs.cpSync(source, dest, { recursive: true });
