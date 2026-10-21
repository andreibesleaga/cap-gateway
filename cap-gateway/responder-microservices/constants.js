// Translation engine settings (environment variables with the original defaults).
// The default engine is LibreTranslate; its public instance requires an API key,
// a self-hosted instance usually does not.
export const TRANSLATOR_URL = process.env.TRANSLATOR_URL ?? 'https://libretranslate.com/translate';
export const TRANSLATOR_KEY = process.env.TRANSLATOR_KEY ?? '';
