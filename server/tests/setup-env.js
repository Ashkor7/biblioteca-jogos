import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveTestDatabaseUrl } from './test-db-url.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
// Segredo próprio dos testes: não depende do que estiver no .env.
process.env.SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-uploads-'));
process.env.LOGIN_RATE_LIMIT = '1000';
process.env.PUBLIC_READ = 'false';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.MAX_UPLOAD_MB = '1';
