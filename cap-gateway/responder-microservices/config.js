// Responder configuration, read once from the environment. parseConfig is pure so it can be unit-tested;
// an invalid configuration throws at start-up instead of failing on the first alert.

export const ENGINES = Object.freeze(['libretranslate', 'llm', 'deepl', 'microsoft', 'yandex', 'mymemory', 'stub']);

const DEFAULT_URLS = Object.freeze({
  libretranslate: 'https://libretranslate.com/translate',
  microsoft: 'https://api.cognitive.microsofttranslator.com/translate',
  yandex: 'https://translate.api.cloud.yandex.net/translate/v2/translate',
  mymemory: 'https://api.mymemory.translated.net/get',
});
const KEY_REQUIRED = Object.freeze(['deepl', 'microsoft', 'yandex']);

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_LLM_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_LLM_MODEL = 'google/gemini-3.5-flash-lite';

const positiveInt = (value, fallback, name) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer (milliseconds)`);
  return n;
};

// DeepL serves free-plan keys (suffix ":fx") from a separate host
const deeplUrl = key => `https://${key.endsWith(':fx') ? 'api-free' : 'api'}.deepl.com/v2/translate`;

export function parseConfig(env) {
  const engine = (env.TRANSLATOR_ENGINE || 'libretranslate').trim().toLowerCase();
  if (!ENGINES.includes(engine)) {
    throw new Error(`TRANSLATOR_ENGINE must be one of: ${ENGINES.join(', ')}`);
  }
  const key = env.TRANSLATOR_KEY ?? '';
  if (KEY_REQUIRED.includes(engine) && !key) throw new Error(`TRANSLATOR_KEY is required for ${engine}`);

  const config = {
    engine,
    timeoutMs: positiveInt(env.TRANSLATOR_TIMEOUT, DEFAULT_TIMEOUT_MS, 'TRANSLATOR_TIMEOUT'),
    url: env.TRANSLATOR_URL || (engine === 'deepl' ? deeplUrl(key) : (DEFAULT_URLS[engine] ?? '')),
    key,
    region: env.TRANSLATOR_REGION ?? '',
  };

  if (engine === 'llm') {
    if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required for the llm engine');
    const baseUrl = (env.LLM_BASE_URL || DEFAULT_LLM_BASE_URL).replace(/\/+$/, '');
    Object.assign(config, {
      url: `${baseUrl}/chat/completions`,
      key: env.OPENROUTER_API_KEY,
      model: env.LLM_MODEL || DEFAULT_LLM_MODEL,
    });
  }
  return Object.freeze(config);
}

// Safe one-line description for the start-up log: never includes a key
export const describeConfig = c =>
  `engine=${c.engine}${c.url ? ` endpoint=${new URL(c.url).origin}` : ''}${c.model ? ` model=${c.model}` : ''} timeout=${c.timeoutMs}ms`;
