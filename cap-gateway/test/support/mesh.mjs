// Starts real gateway and responder processes, isolated from any other cote mesh on the machine
// by a unique COTE_ENV, and waits until the gateway reports the expected number of responders.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { ROOT } from './files.mjs';

// settings that must come from the scenario, never from the developer's shell
const CONTROLLED =
  /^(TRANSLATOR_|LLM_|OPENROUTER_|SERVICE_TIMEOUT$|APP_PORT$|BODY_LIMIT$|ACCESS_LOGS_DIR$|NODE_ENV$|COTE_)/;
const baseEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !CONTROLLED.test(k)));

export const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer().once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

let meshCount = 0;

export async function startMesh({ responders = 1, responderEnv = {}, gatewayEnv = {}, readyTimeoutMs = 30000 } = {}) {
  const env = { ...baseEnv(), COTE_ENV: `cap-e2e-${process.pid}-${(meshCount += 1)}`, LOG_LEVEL: 'info' };
  const port = await freePort();
  const children = [];
  let exited = null;

  const spawnNode = (dir, extraEnv) => {
    const child = spawn(process.execPath, ['index.js'], {
      cwd: join(ROOT, dir),
      env: { ...env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.lines = [];
    const collect = chunk => child.lines.push(...String(chunk).split('\n').filter(Boolean));
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('exit', code => {
      child.exitCode ??= code;
      if (!child.stopping) exited ??= `${dir} exited with ${code}: ${child.lines.slice(-5).join(' | ')}`;
    });
    children.push(child);
    return child;
  };

  const responderProcs = Array.from({ length: responders }, () => spawnNode('responder-microservices', responderEnv));
  const gateway = spawnNode('gateway', { APP_PORT: String(port), ACCESS_LOGS_DIR: '', ...gatewayEnv });
  const baseUrl = `http://127.0.0.1:${port}`;

  const stop = () =>
    Promise.all(
      children.map(c =>
        c.exitCode !== null && c.exitCode !== undefined
          ? null
          : new Promise(resolve => {
              c.stopping = true;
              c.once('exit', resolve);
              c.kill('SIGTERM');
            })
      )
    );

  const deadline = Date.now() + readyTimeoutMs;
  for (;;) {
    if (exited) {
      await stop();
      throw new Error(exited);
    }
    try {
      const health = await (await fetch(`${baseUrl}/health`)).json();
      if (health.responders === responders) break;
    } catch {
      // gateway not listening yet
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`mesh not ready after ${readyTimeoutMs} ms`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  return { baseUrl, gateway, responders: responderProcs, stop };
}
