import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ROOT, readAlert } from '../../test/support/files.mjs';
import { handledCount } from '../support/world.mjs';

// Independent oracle: the gateway's XML library (libxml2) and the gateway's XSD validator
const libxml = createRequire(join(ROOT, 'gateway', 'package.json'))('libxmljs2');
const { validateCapXml } = await import('../../gateway/middlewares/schemaValidator.js');
const NS = { cap: 'urn:oasis:names:tc:emergency:cap:1.2' };
// CAP 1.2 free-text <info> fields (the test's own copy of the rule in docs/adr/0001)
const FREE_TEXT = [
  'event',
  'audience',
  'senderName',
  'headline',
  'description',
  'instruction',
  'contact',
  'resourceDesc',
  'areaDesc',
];

const infoBlocks = xml => libxml.parseXml(xml).find('/cap:alert/cap:info', NS);
const languageOf = info => info.get('cap:language', NS)?.text().trim() ?? 'en-US';
const freeText = info =>
  FREE_TEXT.flatMap(name => info.find(`.//cap:${name}`, NS).map((el, i) => [`${name}[${i}]`, el.text().trim()])).filter(
    ([, t]) => t
  );
// the block with language and free text blanked: what must be identical between a source block and its copy
const skeleton = info => {
  const copy = info.clone();
  copy.get('cap:language', NS)?.text('');
  FREE_TEXT.forEach(name => copy.find(`.//cap:${name}`, NS).forEach(el => el.text('')));
  return copy.toString();
};

const post = async (world, body, rawBody) => {
  world.before = world.mesh.responders.map(handledCount);
  const started = performance.now();
  world.response = await fetch(`${world.mesh.baseUrl}/app/cap/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody ?? JSON.stringify(body),
  });
  world.elapsedMs = performance.now() - started;
  world.text = await world.response.text();
};

// original blocks, appended blocks and the source block each appended one was copied from
const analyse = world => {
  const originals = infoBlocks(world.sent);
  const all = infoBlocks(world.text);
  const appended = all.slice(originals.length);
  const sourceLanguage = originals.length ? languageOf(originals[0]).toLowerCase() : '';
  const sources = all.slice(0, originals.length).filter(i => languageOf(i).toLowerCase() === sourceLanguage);
  return { originals, appended, pairs: appended.map((a, i) => [sources[i], a]) };
};

// ------------------------------------------------------------------ Given
Given('the translation mesh is running', async function () {
  await this.useMesh('main');
});
Given('a gateway with no responder', async function () {
  await this.useMesh('no-responder');
});
Given('a mesh whose translation engine is unreachable', async function () {
  await this.useMesh('engine-unreachable');
});
Given('a mesh whose translation engine never answers', async function () {
  await this.useMesh('engine-silent');
});
Given('a mesh whose LLM answers with invalid JSON', async function () {
  await this.useMesh('llm-invalid');
});
Given('the CAP alert {string}', function (name) {
  this.sent = readAlert(name);
});
Given('the message:', function (docString) {
  this.sent = docString;
});
Given('the CAP alert {string} with {string} replaced by {string}', function (name, from, to) {
  this.sent = readAlert(name).replace(from, to);
});
Given('a message of {int} kilobytes', function (kb) {
  this.sent = 'x'.repeat(kb * 1024);
});

// ------------------------------------------------------------------ When
When('the alert is posted to the gateway', async function () {
  await post(this, { message: this.sent });
});
When('the alert is posted to the gateway asking for JSON', async function () {
  await post(this, { message: this.sent, exportJson: true });
});
When('the alert is posted with exportJson set to the string {string}', async function (value) {
  await post(this, { message: this.sent, exportJson: value });
});
When('the message is posted as the value {int}', async function (value) {
  await post(this, { message: value });
});
When('the raw body {string} is posted', async function (raw) {
  await post(this, undefined, raw);
});
When('{int} alerts are posted to the gateway', async function (n) {
  this.statuses = [];
  const before = this.mesh.responders.map(handledCount);
  for (let i = 0; i < n; i += 1) {
    await post(this, { message: this.sent });
    this.statuses.push(this.response.status);
  }
  this.before = before;
});
When('the operator checks the health endpoint', async function () {
  this.response = await fetch(`${this.mesh.baseUrl}/health`);
  this.text = await this.response.text();
});
When('a client requests {string}', async function (path) {
  this.response = await fetch(`${this.mesh.baseUrl}${path}`);
  this.text = await this.response.text();
});

// ------------------------------------------------------------------ Then: protocol
Then('the response status is {int}', function (status) {
  assert.equal(this.response.status, status, this.text.slice(0, 300));
});
Then('every response status is {int}', function (status) {
  assert.ok(
    this.statuses.every(s => s === status),
    String(this.statuses)
  );
});
Then('the X-Translation header is {string}', function (value) {
  assert.equal(this.response.headers.get('x-translation'), value, this.text.slice(0, 300));
});
Then('the response has no X-Translation header', function () {
  assert.equal(this.response.headers.get('x-translation'), null);
});
Then('the response is XML', function () {
  assert.match(this.response.headers.get('content-type'), /^application\/xml/);
});
Then('the response is JSON', function () {
  assert.match(this.response.headers.get('content-type'), /^application\/json/);
  this.json = JSON.parse(this.text);
});
Then('the error message says {string}', function (message) {
  assert.equal(JSON.parse(this.text).error, message);
});
Then('the response took less than {int} seconds', function (seconds) {
  assert.ok(this.elapsedMs < seconds * 1000, `${Math.round(this.elapsedMs)} ms`);
});
Then('no responder received it', function () {
  assert.deepEqual(this.mesh.responders.map(handledCount), this.before);
});

// ------------------------------------------------------------------ Then: alert content
Then('the response body is the alert exactly as sent', function () {
  assert.equal(this.text, this.sent.trim());
});
Then('the response has {int} original(s) and {int} appended en-US info block(s)', function (originals, appended) {
  const a = analyse(this);
  assert.equal(a.originals.length, originals);
  assert.equal(a.appended.length, appended);
  a.appended.forEach(block => assert.equal(languageOf(block), 'en-US'));
});
Then('the original alert is unchanged inside the response', function () {
  // the response is the sent alert with one contiguous insertion
  const sent = this.sent.trim();
  let p = 0;
  while (p < sent.length && sent[p] === this.text[p]) p += 1;
  const inserted = this.text.length - sent.length;
  assert.ok(inserted > 0, 'nothing was inserted');
  assert.equal(this.text.slice(0, p) + this.text.slice(p + inserted), sent);
});
Then('the appended block copies every enumerated and coded field verbatim', function () {
  for (const [source, copy] of analyse(this).pairs) assert.equal(skeleton(copy), skeleton(source));
});
Then('the appended block translates the free-text fields', function () {
  for (const [source, copy] of analyse(this).pairs) {
    const from = Object.fromEntries(freeText(source));
    const to = Object.fromEntries(freeText(copy));
    assert.deepEqual(Object.keys(to), Object.keys(from), 'free-text fields lost or added');
    if (this.engine === 'stub') {
      for (const key of Object.keys(from)) assert.equal(to[key], `[en] ${from[key]}`, key);
    } else {
      for (const key of Object.keys(from).filter(k => /^(description|instruction)/.test(k))) {
        assert.notEqual(to[key], from[key], `${key} was not translated`);
      }
    }
  }
});
Then('the response validates against the CAP 1.2 schema', function () {
  assert.deepEqual(validateCapXml(this.text), { ok: true });
});
Then('the response still contains the original CDATA section', function () {
  const cdata = /<!\[CDATA\[[\s\S]*?\]\]>/.exec(this.sent)[0];
  assert.ok(this.text.includes(cdata));
});
Then('the appended block was copied from the {string} block', function (language) {
  const { pairs } = analyse(this);
  assert.ok(pairs.length > 0);
  pairs.forEach(([source]) => assert.equal(languageOf(source), language));
});

// ------------------------------------------------------------------ Then: real engines
const englishText = world =>
  analyse(world)
    .appended.flatMap(b =>
      freeText(b)
        .filter(([k]) => /^(description|instruction)/.test(k))
        .map(([, t]) => t)
    )
    .join(' ');
Then('the appended description and instruction read as English', function () {
  const text = englishText(this);
  const letters = text.match(/\p{L}/gu) ?? [];
  const ascii = letters.filter(c => /[A-Za-z]/.test(c));
  assert.ok(letters.length > 20, text);
  assert.ok(ascii.length / letters.length >= 0.97, `not English-looking: ${text}`);
  assert.match(text, /\b(the|and|of|to|in|is|are|with|from|your|you)\b/i, text);
  this.attach(`English text: ${text}`);
});
Then('the appended text mentions one of {string}', function (keywords) {
  const text = analyse(this)
    .appended.flatMap(b => freeText(b).map(([, t]) => t))
    .join(' ')
    .toLowerCase();
  const words = keywords.split(',').map(w => w.trim().toLowerCase());
  assert.ok(
    words.some(w => text.includes(w)),
    `none of ${words.join('/')} in: ${text}`
  );
});

// ------------------------------------------------------------------ Then: JSON
Then('the JSON alert has {int} info entry/entries and the last has language {string}', function (count, language) {
  const info = [this.json.alert.info].flat();
  assert.equal(info.length, count);
  assert.equal(info.at(-1).language ?? 'en-US', language);
});
Then('the JSON alert keeps the CAP namespace and the identifier {string}', function (identifier) {
  assert.equal(this.json.alert['@_xmlns'], NS.cap);
  assert.equal(this.json.alert.identifier, identifier);
});
Then('the last JSON info entry is the English copy of the first', function () {
  const [first, last] = [this.json.alert.info[0], this.json.alert.info.at(-1)];
  assert.equal(last.category, first.category);
  assert.equal(last.urgency, first.urgency);
  assert.notEqual(last.description, first.description);
});

// ------------------------------------------------------------------ Then: operations
Then('each of the {int} responders handled {int} of them', function (count, each) {
  assert.equal(this.mesh.responders.length, count);
  const handled = this.mesh.responders.map((r, i) => handledCount(r) - this.before[i]);
  assert.deepEqual(handled, Array(count).fill(each));
});
Then('the health report shows {int} responder(s)', function (n) {
  assert.equal(JSON.parse(this.text).responders, n);
});
Then('the fake LLM received {int} requests', function (n) {
  assert.equal(this.mesh.fake.requests, n);
});
