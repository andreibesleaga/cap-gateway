/* eslint-disable no-unused-vars */

import dotenv from 'dotenv';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import translateWithLibre from './translator.js';

dotenv.config({ silent: process.env.NODE_ENV === 'production' });
const getError = error => ({ error: error?.response?.data ?? error?.response?.message ?? error?.response });

// Function to traverse and modify the JSON object
const translateJson = async (obj, translationEngine) => {
  for (let key in obj) {
    if (key === 'info') {
      if (typeof obj[key] === 'string') {
        let lang = obj[key]['language'];
        if(lang.includes('en') === false) {
          let newContent = await translationEngine(obj[key], lang.substring(0,2), 'en');
          obj[key] += newContent;
        }
      } else if (typeof obj[key] === 'object') {
        obj[key] = translateJson(obj[key]);
      }
    } else if (typeof obj[key] === 'object') {
      obj[key] = translateJson(obj[key]);
    }
  }
  return obj;
};


let translate = async (xmlMessage, exportJson) => {
  try {
    exportJson = typeof exportJson === 'undefined' ? false: exportJson;
    const parserOptions = {
      attributes: {
          ignore: false,
          booleanType:true
      }
    };

    // Parse the XML to JSON
    const parser = new XMLParser(parserOptions);
    const xmlData = parser.parse(xmlMessage);

    // Modify the JSON object - select the translation engine API
    const modifiedJsonObj = await translateJson(xmlData, translateWithLibre);

    if(exportJson) {
      return modifiedJsonObj;
    } else {
      // Convert the modified JSON back to XML
      const builder = new XMLBuilder();
      const modifiedXmlData = builder.build(modifiedJsonObj);
      return modifiedXmlData;
    }
  } catch (error) {
    console.log(error);
    return({error:getError(error), status:500 });
  }
};

export default {
  translate,
};
