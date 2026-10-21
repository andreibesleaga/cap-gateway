import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseConfig,
  describeConfig,
  ENGINES,
  DEFAULT_LLM_MODEL,
  DEFAULT_TIMEOUT_MS,
} from '../../responder-microservices/config.js';

test('defaults: LibreTranslate public instance, no key, 8 s timeout', () => {
  assert.deepEqual(
    { ...parseConfig({}) },
    {
      engine: 'libretranslate',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      url: 'https://libretranslate.com/translate',
      key: '',
      region: '',
    }
  );
});

test('every documented engine is selectable, case-insensitively', () => {
  assert.deepEqual(ENGINES, ['libretranslate', 'llm', 'deepl', 'microsoft', 'yandex', 'mymemory', 'stub']);
  const env = { TRANSLATOR_KEY: 'k', OPENROUTER_API_KEY: 'o' };
  for (const name of ENGINES) assert.equal(parseConfig({ ...env, TRANSLATOR_ENGINE: name.toUpperCase() }).engine, name);
});

test('an unknown engine or a missing key fails at start-up', () => {
  assert.throws(() => parseConfig({ TRANSLATOR_ENGINE: 'google' }), /TRANSLATOR_ENGINE must be one of/);
  for (const engine of ['deepl', 'microsoft', 'yandex']) {
    assert.throws(() => parseConfig({ TRANSLATOR_ENGINE: engine }), /TRANSLATOR_KEY is required/);
  }
  assert.throws(() => parseConfig({ TRANSLATOR_ENGINE: 'llm' }), /OPENROUTER_API_KEY is required/);
});

test('TRANSLATOR_TIMEOUT must be a positive integer', () => {
  assert.equal(parseConfig({ TRANSLATOR_TIMEOUT: '2500' }).timeoutMs, 2500);
  for (const bad of ['0', '-1', '1.5', 'abc']) {
    assert.throws(() => parseConfig({ TRANSLATOR_TIMEOUT: bad }), /TRANSLATOR_TIMEOUT/);
  }
});

test('TRANSLATOR_URL overrides the engine default', () => {
  assert.equal(
    parseConfig({ TRANSLATOR_URL: 'http://localhost:5055/translate' }).url,
    'http://localhost:5055/translate'
  );
});

test('llm: OpenRouter by default, configurable base URL and model', () => {
  const c = parseConfig({ TRANSLATOR_ENGINE: 'llm', OPENROUTER_API_KEY: 'o' });
  assert.equal(c.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(c.model, DEFAULT_LLM_MODEL);
  const custom = parseConfig({
    TRANSLATOR_ENGINE: 'llm',
    OPENROUTER_API_KEY: 'o',
    LLM_BASE_URL: 'http://x/v1//',
    LLM_MODEL: 'm',
  });
  assert.equal(custom.url, 'http://x/v1/chat/completions');
  assert.equal(custom.model, 'm');
});

test('the configuration is frozen and its description never contains a key', () => {
  const c = parseConfig({ TRANSLATOR_ENGINE: 'llm', OPENROUTER_API_KEY: 'sk-or-secret' });
  assert.ok(Object.isFrozen(c));
  assert.equal(
    describeConfig(c),
    `engine=llm endpoint=https://openrouter.ai model=${DEFAULT_LLM_MODEL} timeout=8000ms`
  );
  assert.equal(describeConfig(parseConfig({ TRANSLATOR_ENGINE: 'stub' })), 'engine=stub timeout=8000ms');
});
