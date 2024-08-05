import axios from 'axios';
import dotenv from 'dotenv';

// read config values
dotenv.config({ silent: process.env.NODE_ENV === 'production' });
const { TRANSLATOR_KEY } = process.env;

const translateWithLibre = async (text, source, target) => {
  const response = await axios.post('https://libretranslate.com/translate', {
    q: text,
    source: source,
    target: target,
    format: 'text'
  });
  return response.data.translatedText;
};

const translateWithYandex = async (text, source, target) => {
  const response = await axios.get(`https://translate.yandex.net/api/v1.5/tr.json/translate`, {
    params: {
      key: TRANSLATOR_KEY,
      text: text,
      lang: `${source}-${target}`
    }
  });
  return response.data.text[0];
};

const translateWithDeepL = async (text, source, target) => {
  const response = await axios.post('https://api.deepl.com/v2/translate', null, {
    params: {
      auth_key: TRANSLATOR_KEY,
      text: text,
      source_lang: source.toUpperCase(),
      target_lang: target.toUpperCase()
    }
  });
  return response.data.translations[0].text;
};

const translateWithMicrosoft = async (text, source, target) => {
  const response = await axios.post('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0', [{
    text: text
  }], {
    params: {
      from: source,
      to: target
    },
    headers: {
      'Ocp-Apim-Subscription-Key': TRANSLATOR_KEY,
      'Content-type': 'application/json'
    }
  });
  return response.data[0].translations[0].text;
};

const translateWithGoogle = async (text, source, target) => {
  const { Translate } = require('@google-cloud/translate').v2;
  const translate = new Translate({ key: TRANSLATOR_KEY });
  const [translation] = await translate.translate(text, target);
  return translation;
};

const translateWithMyMemory = async (text, source, target) => {
  const response = await axios.get('https://api.mymemory.translated.net/get', {
    params: {
      q: text,
      langpair: `${source}|${target}`
    }
  });
  return response.data.responseData.translatedText;
};

export default {
  translateWithLibre,
  translateWithYandex,
  translateWithDeepL,
  translateWithMicrosoft,
  translateWithGoogle,
  translateWithMyMemory
};
