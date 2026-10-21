/**
 * Smoke test - run from cap-gateway/ with `npm test`. Exits non-zero on the first failure.
 *
 * Part A: the translation service in-process with a stub engine (no network, no mesh).
 * Part B: end to end - a local stub translator HTTP server, one responder and the gateway
 *         are started as child processes and real HTTP requests go through the mesh.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATEWAY_PORT = Number(process.env.SMOKE_GATEWAY_PORT ?? 5050);
const enXml = readFileSync(join(ROOT, 'samples', 'alert-en.xml'), 'utf-8');
const roXml = readFileSync(join(ROOT, 'samples', 'alert-ro.xml'), 'utf-8');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`);
  if (!ok) failures += 1;
};
const stub = async (text, source, target) => `EN(${text}){${source}:${target}}`;

// ---------------------------------------------------------------- Part A
console.log('Part A: service in-process');
const { default: CapService } = await import('../responder-microservices/services/cap.js');

const enOut = await CapService.translate(enXml, false, stub);
check('A1 English alert is returned unchanged', enOut === enXml);

const roOut = await CapService.translate(roXml, false, stub);
check('A2 Romanian alert: description translated', /<description>EN\(Sunt/.test(roOut), roOut);
check('A3 Romanian alert: instruction translated', /<instruction>EN\(Răm/.test(roOut));
check('A4 Romanian alert: areaDesc translated', /<areaDesc>EN\(Jude/.test(roOut));
check(
  'A5 Romanian alert: headline and header fields untouched',
  /<headline>Avertizare/.test(roOut) &&
    /<identifier>EXAMPLE-RO-0001</.test(roOut) &&
    /<sent>2024-08-05T13:00:00\+03:00</.test(roOut)
);
check('A6 Romanian alert: language code passed through', /\{ro-RO:en\}/.test(roOut));
check(
  'A7 XML declaration and namespace preserved',
  /<\?xml version="1.0" encoding="UTF-8"\?>/.test(roOut) && /xmlns="urn:oasis:names:tc:emergency:cap:1.2"/.test(roOut)
);

const roJson = await CapService.translate(roXml, true, stub);
check(
  'A8 exportJson returns an object with translated info',
  typeof roJson === 'object' && roJson.alert?.info?.description?.startsWith('EN('),
  JSON.stringify(roJson).slice(0, 200)
);

const noLang = await CapService.translate(enXml.replace('<language>en-US</language>\n    ', ''), false, stub);
check('A9 missing <language> means en-US: no translation', !noLang.includes('EN('));

// ---------------------------------------------------------------- Part B
console.log('Part B: end to end through gateway + responder');
const translator = createServer((req, res) => {
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    const { q, source, target } = JSON.parse(body);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ translatedText: `EN(${q}){${source}:${target}}` }));
  });
});
await new Promise(resolve => translator.listen(0, '127.0.0.1', resolve));
const translatorUrl = `http://127.0.0.1:${translator.address().port}/translate`;

const children = [];
const start = (dir, env) => {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: join(ROOT, dir),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.env.SMOKE_VERBOSE && process.stdout.write(`[${dir}] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[${dir}] ${d}`));
  children.push(child);
  return child;
};
const stopAll = () => children.forEach(c => c.kill('SIGTERM'));
process.on('exit', stopAll);

start('responder-microservices', { TRANSLATOR_URL: translatorUrl, TRANSLATOR_KEY: '' });
start('gateway', { APP_PORT: String(GATEWAY_PORT), ACCESS_LOGS_DIR: '', SERVICE_TIMEOUT: '15000' });

const base = `http://127.0.0.1:${GATEWAY_PORT}`;
const waitForGateway = async () => {
  for (let i = 0; i < 100; i += 1) {
    try {
      await fetch(base + '/');
      return;
    } catch {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  throw new Error('gateway did not start');
};
await waitForGateway();

const post = (body, extra = {}) =>
  fetch(base + '/app/cap/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });

let r = await fetch(base + '/nothing');
check('B1 unknown route returns 404 JSON', r.status === 404 && (await r.json()).error === 'Not found');

r = await post({ message: '<alert>' });
check('B2 malformed XML returns 400', r.status === 400, await r.text());

r = await post({ message: '<foo/>' });
check('B3 well-formed non-CAP XML returns 400', r.status === 400, await r.text());

r = await post({ message: enXml });
let text = await r.text();
check(
  'B4 English alert returns 200 and the same XML',
  r.status === 200 && text === enXml.trim(),
  `${r.status} ${text.slice(0, 120)}`
);

r = await post({ message: roXml });
text = await r.text();
check(
  'B5 Romanian alert returns 200 with translated description',
  r.status === 200 && /<description>EN\(Sunt/.test(text),
  `${r.status} ${text.slice(0, 200)}`
);
check('B6 Romanian alert: translator called with ro>en', /\{ro:en\}/.test(text));

r = await post({ message: roXml, exportJson: true });
const json = r.status === 200 ? await r.json() : await r.text();
check(
  'B7 exportJson returns JSON with translated info',
  r.status === 200 && json.alert?.info?.description?.startsWith('EN('),
  JSON.stringify(json).slice(0, 200)
);

translator.close();
stopAll();
console.log(failures === 0 ? '\nSMOKE OK' : `\nSMOKE FAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
