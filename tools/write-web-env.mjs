import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('apps/web-mzima-client/src/env.json');
const env = JSON.parse(readFileSync(envPath, 'utf8'));

if (process.env.BACKEND_URL) {
  env.backend_url = process.env.BACKEND_URL;
}

if (process.env.OAUTH_CLIENT_ID) {
  env.oauth_client_id = process.env.OAUTH_CLIENT_ID;
}

if (process.env.OAUTH_CLIENT_SECRET) {
  env.oauth_client_secret = process.env.OAUTH_CLIENT_SECRET;
}

writeFileSync(envPath, `${JSON.stringify(env, null, 2)}\n`);

console.log(`Using backend_url: ${env.backend_url}`);
