import axios from 'axios';
import { TRANSLATOR_KEY } from '../constants.js';
import logger from '../logger.js';

const translateWithLibre = async (text, source, target) => {
  try {
    const response = await axios.post('https://libretranslate.com/translate', {
      q: text,
      source: source,
      target: target,
      format: 'text'
    });
    return response.data.translatedText;
  } catch (error) {
    logger.error('LibreTranslate error:', error);
    throw new Error('LibreTranslate failed');
  }
};

const translateWithYandex = async (text, source, target) => {
  try {
    const response = await axios.get(`https://translate.yandex.net/api/v1.5/tr.json/translate`, {
      params: {
        key: TRANSLATOR_KEY,
        text: text,
        lang: `${source}-${target}`
      }
    });
    return response.data.text[0];
  } catch (error) {
    logger.error('Yandex Translate error:', error);
    throw new Error('Yandex Translate failed');
  }
};

const translateWithDeepL = async (text, source, target) => {
  try {
    const response = await axios.post('https://api.deepl.com/v2/translate', null, {
      params: {
        auth_key: TRANSLATOR_KEY,
        text: text,
        source_lang: source.toUpperCase(),
        target_lang: target.toUpperCase()
      }
    });
    return response.data.translations[0].text;
  } catch (error) {
    logger.error('DeepL Translate error:', error);
    throw new Error('DeepL Translate failed');
  }
};

const translateWithMicrosoft = async (text, source, target) => {
  try {
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
  } catch (error) {
    logger.error('Microsoft Translate error:', error);
    throw new Error('Microsoft Translate failed');
  }
};

import { v2 as GoogleTranslate } from '@google-cloud/translate';

const translateWithGoogle = async (text, source, target) => {
  try {
    const translate = new GoogleTranslate({ key: TRANSLATOR_KEY });
    const [translation] = await translate.translate(text, target);
    return translation;
  } catch (error) {
    logger.error('Google Translate error:', error);
    throw new Error('Google Translate failed');
  }
};

const translateWithMyMemory = async (text, source, target) => {
  try {
    const response = await axios.get('https://api.mymemory.translated.net/get', {
      params: {
        q: text,
        langpair: `${source}|${target}`
      }
    });
    return response.data.responseData.translatedText;
  } catch (error) {
    logger.error('MyMemory Translate error:', error);
    throw new Error('MyMemory Translate failed');
  }
};

export {
  translateWithLibre,
  translateWithYandex,
  translateWithDeepL,
  translateWithMicrosoft,
  translateWithGoogle,
  translateWithMyMemory
};
