/**
 * E2E tier against a real LibreTranslate in Docker: starts the pinned image with only the languages the
 * scenarios need, waits until it serves them, runs the @translation scenarios (cucumber profile "libre"),
 * then stops the container. Models are cached in the Docker volume cap-gateway-libre-models; --update-models
 * installs a language added to LANGS and refreshes the others (needs network at start-up).
 */
import { spawnSync, spawn } from 'node:child_process';

const IMAGE = 'libretranslate/libretranslate:v1.9.6';
const NAME = 'cap-gateway-e2e-libre';
const PORT = Number(process.env.LIBRE_PORT ?? 5055);
const LANGS = ['en', 'ro', 'fr', 'es', 'de', 'fi'];
const READY_TIMEOUT_MS = 20 * 60 * 1000;
const base = `http://127.0.0.1:${PORT}`;
const seconds = since => ((performance.now() - since) / 1000).toFixed(1);
const docker = (...args) => spawnSync('docker', args, { encoding: 'utf-8' });

if (docker('version', '--format', '{{.Server.Version}}').status !== 0) {
  console.error('docker is not available: this tier needs a running Docker daemon');
  process.exit(1);
}
docker('rm', '-f', NAME);

const t0 = performance.now();
const run = docker(
  'run',
  '-d',
  '--rm',
  '--name',
  NAME,
  '-p',
  `127.0.0.1:${PORT}:5000`,
  '-v',
  'cap-gateway-libre-models:/home/libretranslate/.local',
  IMAGE,
  '--load-only',
  LANGS.join(','),
  // without this, a cached volume with older models never gets a newly added language
  '--update-models'
);
if (run.status !== 0) {
  console.error(run.stderr);
  process.exit(1);
}
const stop = () => docker('stop', NAME);
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});

console.log(`waiting for ${IMAGE} on ${base} (the first start downloads the language models)...`);
let ready = false;
while (!ready && performance.now() - t0 < READY_TIMEOUT_MS) {
  try {
    const codes = (await (await fetch(`${base}/languages`)).json()).map(l => l.code);
    ready = LANGS.every(code => codes.includes(code));
  } catch {
    // not listening yet
  }
  if (!ready) await new Promise(r => setTimeout(r, 2000));
}
if (!ready) {
  console.error(`LibreTranslate not ready after ${READY_TIMEOUT_MS / 1000} s`);
  console.error(docker('logs', '--tail', '20', NAME).stdout);
  stop();
  process.exit(1);
}
const startup = seconds(t0);
console.log(`LibreTranslate ready in ${startup} s`);

const t1 = performance.now();
const code = await new Promise(resolve =>
  spawn('npx', ['cucumber-js', '--profile', 'libre'], {
    stdio: 'inherit',
    env: { ...process.env, LIBRE_URL: `${base}/translate` },
  }).on('exit', resolve)
);
console.log(`\nLibreTranslate tier: container ready in ${startup} s, scenarios ${seconds(t1)} s, exit code ${code}`);
stop();
process.exit(code ?? 1);
