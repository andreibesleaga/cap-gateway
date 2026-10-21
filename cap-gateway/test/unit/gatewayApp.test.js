import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readAlert } from '../support/files.mjs';
import { createApp } from '../../gateway/app.js';
import { sendToMesh, connectedResponders } from '../../gateway/mesh.js';

// Stand-in for a cote Requester: `connected` sockets, `reply(msg)` decides the answer
const fakeRequester = ({ connected = 1, reply = () => ({}) } = {}) => {
  const sent = [];
  return {
    sent,
    timeout: 1234,
    sock: { socks: Array.from({ length: connected }) },
    async send(message) {
      sent.push(message);
      return reply(message);
    },
  };
};

const servers = [];
after(() => servers.forEach(s => s.close()));
const start = async requesters => {
  const server = createApp(requesters).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise(r => server.once('listening', r));
  return `http://127.0.0.1:${server.address().port}`;
};
const postJson = (base, body, path = '/app/cap/translate') =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

test('connectedResponders counts the requester sockets', () => {
  assert.equal(connectedResponders(fakeRequester({ connected: 2 })), 2);
  assert.equal(connectedResponders(undefined), 0);
});

test('sendToMesh: 503 without responders (nothing sent), 504 on timeout, 500 on other errors', async () => {
  const none = fakeRequester({ connected: 0 });
  assert.deepEqual(await sendToMesh(none, { type: 'x' }), { status: 503, error: 'No translation responder available' });
  assert.equal(none.sent.length, 0);
  const slow = fakeRequester({
    reply: () => {
      throw new Error('Request timed out.');
    },
  });
  assert.deepEqual(await sendToMesh(slow, {}), { status: 504, error: 'No responder replied within 1234 ms' });
  const broken = fakeRequester({
    reply: () => {
      throw new Error('socket hang up');
    },
  });
  assert.deepEqual(await sendToMesh(broken, {}), { status: 500, error: 'Mesh request failed' });
  assert.deepEqual(await sendToMesh(fakeRequester({ reply: () => 'r' }), {}), { reply: 'r' });
});

test('translate: XML reply with X-Translation header and an XML content type', async () => {
  const cap = fakeRequester({ reply: m => ({ translation: 'translated', message: `${m.message}<!-- en -->` }) });
  const base = await start({ capRequester: cap, adminRequester: fakeRequester() });
  const xml = readAlert('alert-ro.xml');
  const res = await postJson(base, { message: `  ${xml}\n`, exportJson: 'true' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-translation'), 'translated');
  assert.match(res.headers.get('content-type'), /^application\/xml/);
  assert.equal(await res.text(), `${xml.trim()}<!-- en -->`);
  assert.deepEqual(cap.sent, [{ type: 'translate', message: xml.trim(), exportJson: false }]);
});

test('translate: JSON reply when exportJson is true', async () => {
  const cap = fakeRequester({ reply: () => ({ translation: 'passthrough', message: { alert: { identifier: 'X' } } }) });
  const base = await start({ capRequester: cap });
  const res = await postJson(base, { message: readAlert('alert-en.xml'), exportJson: true });
  assert.equal(res.headers.get('x-translation'), 'passthrough');
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await res.json(), { alert: { identifier: 'X' } });
});

test('translate: responder error envelope and mesh failures are passed on as JSON errors', async () => {
  const envelope = await start({
    capRequester: fakeRequester({ reply: () => ({ status: 500, error: 'Internal translation service error' }) }),
  });
  const r1 = await postJson(envelope, { message: readAlert('alert-en.xml') });
  assert.equal(r1.status, 500);
  assert.equal(r1.headers.get('x-translation'), null);
  assert.deepEqual(await r1.json(), { error: 'Internal translation service error' });

  const empty = await start({ capRequester: fakeRequester({ connected: 0 }) });
  const r2 = await postJson(empty, { message: readAlert('alert-en.xml') });
  assert.equal(r2.status, 503);
});

test('invalid input never reaches the mesh', async () => {
  const cap = fakeRequester();
  const base = await start({ capRequester: cap });
  const cases = [
    [{ message: '<alert>' }, 400, 'message is not well-formed XML'],
    [{ message: '<foo/>' }, 400, 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema'],
    [{ message: 42 }, 400, 'message must be a string containing CAP XML'],
    [{}, 400, 'message must be a string containing CAP XML'],
    ['{"message": ', 400, 'Malformed Request'],
    ['[1,2]', 400, 'Malformed Request'],
    [{ message: 'x'.repeat(110 * 1024) }, 413, 'Request body larger than 100kb'],
  ];
  for (const [body, status, error] of cases) {
    const res = await postJson(base, body);
    assert.equal(res.status, status, String(body).slice(0, 40));
    assert.equal((await res.json()).error, error);
  }
  const plain = await fetch(base + '/app/cap/translate', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'x',
  });
  assert.equal(plain.status, 400);
  assert.equal(cap.sent.length, 0);
});

test('health reports connected responders; unknown routes are 404 JSON', async () => {
  const up = await start({ capRequester: fakeRequester({ connected: 2 }) });
  const h = await fetch(up + '/health');
  assert.equal(h.status, 200);
  assert.deepEqual(await h.json(), { status: 'ok', responders: 2 });
  const down = await start({ capRequester: fakeRequester({ connected: 0 }) });
  const d = await fetch(down + '/health');
  assert.equal(d.status, 503);
  assert.deepEqual(await d.json(), { status: 'unavailable', responders: 0 });
  const nf = await fetch(up + '/nothing');
  assert.equal(nf.status, 404);
  assert.deepEqual(await nf.json(), { error: 'Not found' });
});

test('admin pubsub forwards to the mesh and returns the responder reply', async () => {
  const admin = fakeRequester({ reply: () => ({ status: 'random heartbeat started' }) });
  const base = await start({ capRequester: fakeRequester(), adminRequester: admin });
  const res = await postJson(base, {}, '/app/admin/services/pubsub');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'random heartbeat started' });
  assert.deepEqual(admin.sent, [{ type: 'start' }]);
  const none = await start({ capRequester: fakeRequester(), adminRequester: fakeRequester({ connected: 0 }) });
  assert.equal((await postJson(none, {}, '/app/admin/services/pubsub')).status, 503);
});
