import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
});

const routes = {};
async function loadRoutes() {
  const files = ['sessions', 'players', 'register', 'waitlist', 'promote', 'create-order', 'confirm-payment'];
  for (const f of files) {
    const mod = await import(`./${f}.js`);
    routes[f] = mod.default;
  }
}

await loadRoutes();

const server = createServer(async (req, rawRes) => {
  if (req.method === 'OPTIONS') {
    rawRes.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
    rawRes.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname.replace('/api/', '');

  if (!routes[route]) {
    rawRes.writeHead(404, { 'Content-Type': 'application/json' });
    rawRes.end(JSON.stringify({ ok: false, error: 'Not found: ' + route }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  const reqObj = { method: req.method, body: body ? JSON.parse(body) : {} };
  const resObj = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    status(code) { this.statusCode = code; return this; },
    json(data) {
      rawRes.writeHead(this.statusCode, this.headers);
      rawRes.end(JSON.stringify(data));
    }
  };

  try {
    await routes[route](reqObj, resObj);
  } catch (err) {
    rawRes.writeHead(500, { 'Content-Type': 'application/json' });
    rawRes.end(JSON.stringify({ ok: false, error: err.message }));
  }
});

server.listen(3001, () => console.log('API dev server running on http://localhost:3001'));
