import validator from 'validator';
import dotenv from 'dotenv';
dotenv.config({ silent: process.env.NODE_ENV === 'production' });

import { HTTP_CODE } from '../constants.js';
const getError = error => ({ error: error?.response?.data ?? error?.response?.message ?? error?.message ?? error?.response});

const MAX_PARAM_NAME_LENGTH = 50;
const MAX_POST_PARAM_VALUES_LENGTH = 100000;

export async function sanitizeParams(req, res, next) {
  // middleware for basic sanitization of all requests parameters
  try {
    let valType = undefined;
    let newValue = null;

    if (req.body) {
      let strValue = '';
      // sanitize POST values
      for (const [key, value] of Object.entries(req.body)) {
        valType = typeof value;

        if (valType == 'object' && value == null) {
          req.body[key] = null;
        } else {
          if (valType == 'object') {
            strValue = JSON.stringify(value);
          } else {
            strValue = value + '';
          }

          if (valType == 'symbol' || valType == 'function') {
            return res.status(HTTP_CODE.BadRequest).json({ error: 'Malformed Request' });
          }
          if (key.length > MAX_PARAM_NAME_LENGTH || strValue.length > MAX_POST_PARAM_VALUES_LENGTH) {
            return res.status(HTTP_CODE.BadRequest).json({ error: 'Malformed Request' });
          }

          if (valType == 'string') {
            newValue = validator.trim(value);
            newValue = validator.stripLow(newValue, true);
            req.body[key] = newValue;
          }
        }
      }
    }

    next();
  } catch (error) {
    return res.status(error.response?.status ?? error.status ?? HTTP_CODE.ServerError).json(getError(error));
  }
}