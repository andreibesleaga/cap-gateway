import validator from 'validator';
import { HTTP_CODE } from '../constants.js';
import { getError } from '../errors.js';

const MAX_PARAM_NAME_LENGTH = 50;
const MAX_POST_PARAM_VALUES_LENGTH = 100000;

// Middleware: basic sanitisation of all POST body parameters (size limits, trim, strip control chars)
export function sanitizeParams(req, res, next) {
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

    return next();
  } catch (error) {
    return res.status(error.response?.status ?? error.status ?? HTTP_CODE.ServerError).json(getError(error));
  }
}
