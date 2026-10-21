import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAlert } from '../support/files.mjs';
import { createCapService, selectSourceBlocks } from '../../responder-microservices/services/cap.js';
import { createCapController } from '../../responder-microservices/controllers/cap.js';
import { createEngine, TranslationError } from '../../responder-microservices/services/translator.js';
import { validateCapXml } from '../../gateway/middlewares/schemaValidator.js';

const quiet = { info() {}, warn() {}, error() {} };
const stub = createEngine({ engine: 'stub' });

// records every engine call; `fail` decides per call whether to throw
const recordingEngine = (fail = () => false) => {
  const calls = [];
  return {
    calls,
    name: 'recording',
    async translate(source, fields) {
      calls.push({ source, fields });
      if (fail(calls.length, fields)) throw new TranslationError('http 503');
      return stub.translate(source, fields);
    },
  };
};

// the output must be the input with one contiguous insertion
const insertedText = (input, output) => {
  let p = 0;
  while (p < input.length && input[p] === output[p]) p += 1;
  const inserted = output.slice(p, p + output.length - input.length);
  assert.equal(output.slice(0, p) + output.slice(p + inserted.length), input, 'original bytes changed');
  return inserted;
};

test('selectSourceBlocks: nothing to do without <info> or with an English block', () => {
  assert.deepEqual(selectSourceBlocks([]), { reason: 'no <info> block' });
  assert.equal(selectSourceBlocks([{ language: 'ro' }, { language: 'en-US' }]).reason, 'English <info> present');
});

test('selectSourceBlocks: the language of the first block is the source, case-insensitively', () => {
  const blocks = [{ language: 'ro-RO' }, { language: 'fr-FR' }, { language: 'RO-ro' }];
  const { source, selected } = selectSourceBlocks(blocks);
  assert.equal(source, 'ro-RO');
  assert.deepEqual(selected, [blocks[0], blocks[2]]);
});

for (const name of ['alert-en.xml', 'no-language.xml', 'ro-with-en.xml']) {
  test(`passthrough returns ${name} byte-identical without calling the engine`, async () => {
    const engine = recordingEngine();
    const xml = readAlert(name);
    const result = await createCapService({ engine, logger: quiet }).translate(xml);
    assert.equal(result.translation, 'passthrough');
    assert.equal(result.message, xml);
    assert.equal(engine.calls.length, 0);
  });
}

test('an alert without <info> passes through', async () => {
  const xml = readAlert('alert-en.xml').replace(/<info>[\s\S]*<\/info>\s*/, '');
  const result = await createCapService({ engine: stub, logger: quiet }).translate(xml);
  assert.deepEqual(result, { translation: 'passthrough', message: xml, reason: 'no <info> block' });
});

for (const name of [
  'alert-ro.xml',
  'alert-fr.xml',
  'alert-es.xml',
  'alert-de.xml',
  'cdata-utf8.xml',
  'rich-ro.xml',
  'prefixed-ro.xml',
]) {
  test(`${name}: one en-US block appended, originals intact, output valid CAP 1.2`, async () => {
    const engine = recordingEngine();
    const xml = readAlert(name);
    const result = await createCapService({ engine, logger: quiet }).translate(xml);
    assert.equal(result.translation, 'translated');
    assert.deepEqual(validateCapXml(result.message), { ok: true });
    const inserted = insertedText(xml, result.message);
    assert.match(inserted, /<(cap:)?info>[\s\S]*<\/(cap:)?info>/);
    assert.match(inserted, /<(cap:)?language>en-US<\/(cap:)?language>/);
    assert.equal(engine.calls.length, 1);
    assert.match(engine.calls[0].source, /^[a-z]{2}-[A-Z]{2}$/);
  });
}

test('several blocks in the source language: one engine call and one appended block each', async () => {
  const engine = recordingEngine();
  const xml = readAlert('multi-ro.xml');
  const result = await createCapService({ engine, logger: quiet }).translate(xml);
  assert.equal(result.translation, 'translated');
  assert.equal(engine.calls.length, 2);
  assert.equal(insertedText(xml, result.message).match(/<language>en-US<\/language>/g).length, 2);
  assert.deepEqual(validateCapXml(result.message), { ok: true });
});

test('mixed languages: only the first language sequence is copied, so English appears once', async () => {
  const engine = recordingEngine();
  const xml = readAlert('mixed-ro-fr.xml');
  const result = await createCapService({ engine, logger: quiet }).translate(xml);
  assert.deepEqual(
    engine.calls.map(c => c.source),
    ['ro-RO']
  );
  assert.match(insertedText(xml, result.message), /\[en\] Ploi abundente/);
});

test('field values are sent decoded and come back escaped', async () => {
  const engine = recordingEngine();
  const xml = readAlert('cdata-utf8.xml');
  const result = await createCapService({ engine, logger: quiet }).translate(xml);
  assert.equal(engine.calls[0].fields.headline, 'Avertizare de caniculă & secetă');
  assert.match(result.message, /<headline>\[en\] Avertizare de caniculă &amp; secetă<\/headline>/);
});

test('any engine failure: X-Translation failed, original alert unchanged, no partial block', async () => {
  const engine = recordingEngine(n => n === 2);
  const xml = readAlert('multi-ro.xml');
  const result = await createCapService({ engine, logger: quiet }).translate(xml);
  assert.deepEqual(result, { translation: 'failed', message: xml, reason: 'engine recording: http 503' });
});

test('a block without free text is copied without calling the engine', async () => {
  const engine = recordingEngine();
  const xml = '<alert><info><language>ro</language><event> </event></info></alert>';
  const result = await createCapService({ engine, logger: quiet }).translate(xml);
  assert.equal(engine.calls.length, 0);
  assert.equal(
    result.message,
    '<alert><info><language>ro</language><event> </event></info><info><language>en-US</language><event> </event></info></alert>'
  );
});

test('exportJson returns the parsed alert: originals first, English copy last', async () => {
  const service = createCapService({ engine: stub, logger: quiet });
  const translated = await service.translate(readAlert('alert-ro.xml'), true);
  assert.equal(translated.translation, 'translated');
  const info = translated.message.alert.info;
  assert.equal(info.length, 2);
  assert.equal(info[0].language, 'ro-RO');
  assert.equal(info[1].language, 'en-US');
  assert.equal(info[1].description, `[en] ${info[0].description}`);
  assert.equal(translated.message.alert['@_xmlns'], 'urn:oasis:names:tc:emergency:cap:1.2');
  assert.equal(translated.message['?xml']['@_version'], '1.0');

  const passthrough = await service.translate(readAlert('alert-en.xml'), true);
  assert.equal(passthrough.message.alert.identifier, 'EXAMPLE-EN-0001');
});

test('controller: passes exportJson only when it is true and maps unexpected errors to 500', async () => {
  const seen = [];
  const ok = createCapController({ service: { translate: async (m, j) => seen.push([m, j]) }, logger: quiet });
  await ok.translate({ message: '<x/>', exportJson: 'yes' });
  await ok.translate({ message: undefined, exportJson: true });
  assert.deepEqual(seen, [
    ['<x/>', false],
    ['', true],
  ]);

  const broken = createCapController({
    service: {
      translate: async () => {
        throw new Error('boom');
      },
    },
    logger: quiet,
  });
  assert.deepEqual(await broken.translate({ message: '<x/>' }), {
    status: 500,
    error: 'Internal translation service error',
  });
});
