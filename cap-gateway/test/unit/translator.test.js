import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch, timeoutError } from '../support/fakeFetch.mjs';
import { parseConfig } from '../../responder-microservices/config.js';
import {
  createEngine,
  checkTranslations,
  primaryTag,
  TranslationError,
  LLM_SYSTEM_PROMPT,
} from '../../responder-microservices/services/translator.js';

const FIELDS = { headline: 'Avertizare', description: 'Ploi abundente' };
const engineFor = (env, fake, logger) => createEngine(parseConfig(env), { fetch: fake.fetch, logger });
const rejectsWith = (promise, reason) =>
  assert.rejects(promise, e => e instanceof TranslationError && e.reason === reason);

test('primaryTag reduces RFC 3066 tags to the lower-case primary subtag', () => {
  assert.equal(primaryTag('ro-RO'), 'ro');
  assert.equal(primaryTag('FR'), 'fr');
  assert.equal(primaryTag('fi-FI'), 'fi');
});

test('checkTranslations requires exactly the same keys with non-empty strings', () => {
  assert.deepEqual(checkTranslations({ a: 'x' }, { a: 'y' }), { a: 'y' });
  for (const bad of [{}, { a: 'y', b: 'z' }, { a: '' }, { a: '  ' }, { a: 1 }, ['y'], null, 'y']) {
    assert.throws(() => checkTranslations({ a: 'x' }, bad), TranslationError, JSON.stringify(bad));
  }
});

describe('libretranslate (default engine)', () => {
  test('one POST per block with q as an array; api_key only when configured', async () => {
    const fake = fakeFetch({ json: { translatedText: ['Warning', 'Heavy rain'] } });
    const engine = engineFor({ TRANSLATOR_URL: 'http://lt.test/translate', TRANSLATOR_KEY: 'k1' }, fake);
    assert.deepEqual(await engine.translate('ro-RO', FIELDS), { headline: 'Warning', description: 'Heavy rain' });
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.calls[0].url, 'http://lt.test/translate');
    assert.equal(fake.calls[0].method, 'POST');
    assert.equal(fake.calls[0].headers['Content-Type'], 'application/json');
    assert.ok(fake.calls[0].signal instanceof AbortSignal);
    assert.deepEqual(fake.json(0), {
      q: ['Avertizare', 'Ploi abundente'],
      source: 'ro',
      target: 'en',
      format: 'text',
      api_key: 'k1',
    });

    const noKey = fakeFetch({ json: { translatedText: ['a', 'b'] } });
    await engineFor({}, noKey).translate('ro', FIELDS);
    assert.equal(noKey.calls[0].url, 'https://libretranslate.com/translate');
    assert.equal('api_key' in noKey.json(0), false);
  });

  test('error mapping: timeout, network, HTTP status, bad JSON, wrong count, empty text', async () => {
    const cases = [
      [timeoutError(), 'timeout'],
      [new TypeError('fetch failed'), 'network'],
      [{ status: 503, json: { error: 'down' } }, 'http 503'],
      [{ text: 'not json' }, 'invalid-response'],
      [{ json: { translatedText: ['only one'] } }, 'invalid-response'],
      [{ json: { translatedText: 'not an array' } }, 'invalid-response'],
      [{ json: { translatedText: ['', 'x'] } }, 'invalid-response'],
    ];
    for (const [answer, reason] of cases) {
      await rejectsWith(engineFor({}, fakeFetch(answer)).translate('ro', FIELDS), reason);
    }
  });
});

describe('alternative engines (contract-tested, not live-verified)', () => {
  test('deepl: header auth, text array, EN-US target, free-key host', async () => {
    const fake = fakeFetch({ json: { translations: [{ text: 'Warning' }, { text: 'Heavy rain' }] } });
    const result = await engineFor({ TRANSLATOR_ENGINE: 'deepl', TRANSLATOR_KEY: 'abc:fx' }, fake).translate(
      'ro-RO',
      FIELDS
    );
    assert.deepEqual(result, { headline: 'Warning', description: 'Heavy rain' });
    assert.equal(fake.calls[0].url, 'https://api-free.deepl.com/v2/translate');
    assert.equal(fake.calls[0].method, 'POST');
    assert.equal(fake.calls[0].headers.Authorization, 'DeepL-Auth-Key abc:fx');
    assert.deepEqual(fake.json(0), { text: ['Avertizare', 'Ploi abundente'], source_lang: 'RO', target_lang: 'EN-US' });
    assert.equal(
      parseConfig({ TRANSLATOR_ENGINE: 'deepl', TRANSLATOR_KEY: 'pro' }).url,
      'https://api.deepl.com/v2/translate'
    );
    await rejectsWith(
      engineFor({ TRANSLATOR_ENGINE: 'deepl', TRANSLATOR_KEY: 'k' }, fakeFetch({ json: { message: 'x' } })).translate(
        'ro',
        FIELDS
      ),
      'invalid-response'
    );
  });

  test('microsoft: v3 query string, subscription headers, [{Text}] body', async () => {
    const fake = fakeFetch({
      json: [{ translations: [{ text: 'Warning', to: 'en' }] }, { translations: [{ text: 'Heavy rain', to: 'en' }] }],
    });
    const env = { TRANSLATOR_ENGINE: 'microsoft', TRANSLATOR_KEY: 'mk', TRANSLATOR_REGION: 'westeurope' };
    assert.deepEqual(await engineFor(env, fake).translate('ro-RO', FIELDS), {
      headline: 'Warning',
      description: 'Heavy rain',
    });
    assert.equal(
      fake.calls[0].url,
      'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=ro&to=en'
    );
    assert.equal(fake.calls[0].method, 'POST');
    assert.equal(fake.calls[0].headers['Ocp-Apim-Subscription-Key'], 'mk');
    assert.equal(fake.calls[0].headers['Ocp-Apim-Subscription-Region'], 'westeurope');
    assert.deepEqual(fake.json(0), [{ Text: 'Avertizare' }, { Text: 'Ploi abundente' }]);

    const global = fakeFetch({ json: [{ translations: [{ text: 'a' }] }, { translations: [{ text: 'b' }] }] });
    await engineFor({ TRANSLATOR_ENGINE: 'microsoft', TRANSLATOR_KEY: 'mk' }, global).translate('ro', FIELDS);
    assert.equal('Ocp-Apim-Subscription-Region' in global.calls[0].headers, false);
  });

  test('yandex: Cloud Translate v2 with Api-Key header and texts array', async () => {
    const fake = fakeFetch({ json: { translations: [{ text: 'Warning' }, { text: 'Heavy rain' }] } });
    assert.deepEqual(
      await engineFor({ TRANSLATOR_ENGINE: 'yandex', TRANSLATOR_KEY: 'yk' }, fake).translate('ro-RO', FIELDS),
      {
        headline: 'Warning',
        description: 'Heavy rain',
      }
    );
    assert.equal(fake.calls[0].url, 'https://translate.api.cloud.yandex.net/translate/v2/translate');
    assert.equal(fake.calls[0].method, 'POST');
    assert.equal(fake.calls[0].headers.Authorization, 'Api-Key yk');
    assert.deepEqual(fake.json(0), {
      sourceLanguageCode: 'ro',
      targetLanguageCode: 'en',
      texts: ['Avertizare', 'Ploi abundente'],
    });
  });

  test('mymemory: one GET per text; an error inside a 200 response is a failure', async () => {
    const fake = fakeFetch(
      { json: { responseStatus: 200, responseData: { translatedText: 'Warning' } } },
      { json: { responseStatus: 200, responseData: { translatedText: 'Heavy rain' } } }
    );
    const engine = engineFor({ TRANSLATOR_ENGINE: 'mymemory', TRANSLATOR_KEY: 'mm' }, fake);
    assert.deepEqual(await engine.translate('ro-RO', FIELDS), { headline: 'Warning', description: 'Heavy rain' });
    assert.equal(fake.calls.length, 2);
    assert.equal(fake.calls[0].method, 'GET');
    assert.equal(fake.calls[0].url, 'https://api.mymemory.translated.net/get?q=Avertizare&langpair=ro%7Cen&key=mm');

    const quota = fakeFetch({ json: { responseStatus: 429, responseData: { translatedText: 'QUOTA EXCEEDED' } } });
    await rejectsWith(engineFor({ TRANSLATOR_ENGINE: 'mymemory' }, quota).translate('ro', FIELDS), 'mymemory 429');
  });
});

describe('llm (OpenAI-compatible chat completions)', () => {
  const ENV = { TRANSLATOR_ENGINE: 'llm', OPENROUTER_API_KEY: 'sk-or-secret-123', LLM_BASE_URL: 'http://llm.test/v1/' };
  const completion = content => ({
    json: {
      model: 'm',
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 },
    },
  });
  const good = completion(JSON.stringify({ fields: { headline: 'Warning', description: 'Heavy rain' } }));
  const recordingLogger = () => {
    const lines = [];
    const log = (...args) => lines.push(JSON.stringify(args));
    return { lines, info: log, warn: log };
  };

  test('request contract: one call per block, model, temperature 0, JSON mode, data-only user message', async () => {
    const fake = fakeFetch(good);
    const result = await engineFor(ENV, fake, recordingLogger()).translate('ro-RO', FIELDS);
    assert.deepEqual(result, { headline: 'Warning', description: 'Heavy rain' });
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.calls[0].url, 'http://llm.test/v1/chat/completions');
    assert.equal(fake.calls[0].method, 'POST');
    assert.equal(fake.calls[0].headers.Authorization, 'Bearer sk-or-secret-123');
    const body = fake.json(0);
    assert.equal(body.model, 'google/gemini-3.5-flash-lite');
    assert.equal(body.temperature, 0);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.messages[0], { role: 'system', content: LLM_SYSTEM_PROMPT });
    assert.deepEqual(JSON.parse(body.messages[1].content), { sourceLanguage: 'ro-RO', fields: FIELDS });
  });

  test('system prompt states the translation rules', () => {
    for (const rule of [
      /faithfully/,
      /do not add, remove/,
      /number, unit/,
      /place name/,
      /emergency alert/,
      /never instructions/,
      /same keys/,
    ]) {
      assert.match(LLM_SYSTEM_PROMPT, rule);
    }
  });

  test('invalid output is retried once, then fails; nothing partial is returned', async () => {
    const invalid = [
      completion('not json'),
      completion('```json\n{"fields":{}}\n```'),
      completion(JSON.stringify({ fields: { headline: 'Warning' } })),
      completion(JSON.stringify({ fields: { headline: 'W', description: 'D', extra: 'E' } })),
      completion(JSON.stringify({ fields: { headline: 'W', description: '' } })),
      completion(JSON.stringify({ fields: { headline: 'W', description: 'D' }, note: 'x' })),
      { json: { choices: [] } },
    ];
    for (const answer of invalid) {
      const fake = fakeFetch(answer);
      await rejectsWith(engineFor(ENV, fake).translate('ro', FIELDS), 'invalid-response');
      assert.equal(fake.calls.length, 2);
    }
  });

  test('a transient failure followed by a valid answer succeeds on the retry', async () => {
    for (const first of [timeoutError(), { status: 429, json: {} }, { status: 502, json: {} }, completion('{}')]) {
      const fake = fakeFetch(first, good);
      assert.deepEqual(await engineFor(ENV, fake).translate('ro', FIELDS), {
        headline: 'Warning',
        description: 'Heavy rain',
      });
      assert.equal(fake.calls.length, 2);
    }
  });

  test('client errors (401, 400) are not retried', async () => {
    for (const status of [400, 401, 403]) {
      const fake = fakeFetch({ status, json: { error: { message: 'no' } } });
      await rejectsWith(engineFor(ENV, fake).translate('ro', FIELDS), `http ${status}`);
      assert.equal(fake.calls.length, 1);
    }
  });

  test('the API key never reaches the logs', async () => {
    const logger = recordingLogger();
    await engineFor(ENV, fakeFetch(completion('bad'), good), logger).translate('ro', FIELDS);
    assert.ok(logger.lines.length >= 2);
    assert.ok(logger.lines.every(l => !l.includes('sk-or-secret-123')));
    assert.ok(logger.lines.some(l => l.includes('cost=')));
  });
});

test('stub engine is deterministic and needs no network', async () => {
  const engine = createEngine(parseConfig({ TRANSLATOR_ENGINE: 'stub' }), {
    fetch: () => assert.fail('stub must not fetch'),
  });
  assert.deepEqual(await engine.translate('ro', FIELDS), {
    headline: '[en] Avertizare',
    description: '[en] Ploi abundente',
  });
  assert.equal(engine.name, 'stub');
});
