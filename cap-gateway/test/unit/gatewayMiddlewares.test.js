import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAlert } from '../support/files.mjs';
import { sanitizeParams } from '../../gateway/middlewares/sanitize.js';
import { schemaValidator, validateCapXml } from '../../gateway/middlewares/schemaValidator.js';

// minimal Express req/res doubles
const run = (middleware, body) => {
  const req = { body };
  const res = {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  middleware(req, res, () => (nextCalled = true));
  return { req, res, nextCalled };
};

test('sanitize: trims strings and removes XML-illegal control characters, keeps tab/CR/LF inside', () => {
  const { req, nextCalled } = run(sanitizeParams, {
    message: ' \u0001<a>\tx\r\ny\u0007</a>\n ',
    exportJson: true,
    n: null,
  });
  assert.ok(nextCalled);
  assert.deepEqual(req.body, { message: '<a>\tx\r\ny</a>', exportJson: true, n: null });
});

test('sanitize: no body is left to the validator', () => {
  assert.ok(run(sanitizeParams, undefined).nextCalled);
});

test('sanitize: arrays, primitives, null bodies and long parameter names are malformed', () => {
  for (const body of [[1], 'x', 5, null, { ['k'.repeat(51)]: 'v' }]) {
    const { res, nextCalled } = run(sanitizeParams, body);
    assert.equal(nextCalled, false, JSON.stringify(body));
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, { error: 'Malformed Request' });
  }
  assert.ok(run(sanitizeParams, { ['k'.repeat(50)]: 'v' }).nextCalled);
});

test('validateCapXml accepts every sample and fixture', () => {
  for (const name of ['alert-en.xml', 'alert-ro.xml', 'rich-ro.xml', 'prefixed-ro.xml', 'cdata-utf8.xml']) {
    assert.deepEqual(validateCapXml(readAlert(name)), { ok: true }, name);
  }
});

test('validateCapXml rejects non-strings, DOCTYPE, malformed XML and non-CAP XML', () => {
  assert.equal(validateCapXml(undefined).error, 'message must be a string containing CAP XML');
  assert.equal(validateCapXml({ a: 1 }).error, 'message must be a string containing CAP XML');
  assert.equal(validateCapXml('').error, 'message must be a string containing CAP XML');
  assert.equal(
    validateCapXml('<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>').error,
    'DOCTYPE declarations are not allowed'
  );
  const malformed = validateCapXml('<alert>');
  assert.equal(malformed.error, 'message is not well-formed XML');
  assert.equal(malformed.details.length, 1);
  const notCap = validateCapXml(
    readAlert('alert-en.xml').replace('<urgency>Expected</urgency>', '<urgency>Soon</urgency>')
  );
  assert.equal(notCap.error, 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema');
  assert.ok(notCap.details.length >= 1 && notCap.details.length <= 5);
});

test('schemaValidator middleware: next() when valid, 400 with details otherwise', () => {
  assert.ok(run(schemaValidator, { message: readAlert('alert-en.xml') }).nextCalled);
  const { res, nextCalled } = run(schemaValidator, { message: '<foo/>' });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema');
  assert.ok(Array.isArray(res.payload.details));
  assert.equal(run(schemaValidator, undefined).res.statusCode, 400);
});
