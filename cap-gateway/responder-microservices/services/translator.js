import axios from 'axios';
import { TRANSLATOR_KEY, TRANSLATOR_URL } from '../constants.js';

// Every engine has the same signature: (text, sourceLang, targetLang) => Promise<string>.
// `sourceLang` is the CAP <language> value (RFC 3066, e.g. "ro" or "ro-RO").
// Only translateWithLibre is wired in; the others are kept as drop-in alternatives.

const primaryTag = lang => lang.split('-')[0].toLowerCase();

export const translateWithLibre = async (text, source, target) => {
  const response = await axios.post(TRANSLATOR_URL, {
    q: text,
    source: primaryTag(source),
    target: primaryTag(target),
    format: 'text',
    ...(TRANSLATOR_KEY ? { api_key: TRANSLATOR_KEY } : {}),
  });
  return response.data.translatedText;
};

export const translateWithYandex = async (text, source, target) => {
  const response = await axios.get('https://translate.yandex.net/api/v1.5/tr.json/translate', {
    params: { key: TRANSLATOR_KEY, text, lang: `${primaryTag(source)}-${primaryTag(target)}` },
  });
  return response.data.text[0];
};

export const translateWithDeepL = async (text, source, target) => {
  const response = await axios.post('https://api.deepl.com/v2/translate', null, {
    params: {
      auth_key: TRANSLATOR_KEY,
      text,
      source_lang: primaryTag(source).toUpperCase(),
      target_lang: primaryTag(target).toUpperCase(),
    },
  });
  return response.data.translations[0].text;
};

export const translateWithMicrosoft = async (text, source, target) => {
  const response = await axios.post(
    'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0',
    [{ text }],
    {
      params: { from: primaryTag(source), to: primaryTag(target) },
      headers: { 'Ocp-Apim-Subscription-Key': TRANSLATOR_KEY, 'Content-type': 'application/json' },
    }
  );
  return response.data[0].translations[0].text;
};

export const translateWithMyMemory = async (text, source, target) => {
  const response = await axios.get('https://api.mymemory.translated.net/get', {
    params: { q: text, langpair: `${primaryTag(source)}|${primaryTag(target)}` },
  });
  return response.data.responseData.translatedText;
};
