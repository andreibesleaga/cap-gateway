import logger from '../logger.js';
import { HTTP_CODE } from '../constants.js';

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });

  const statusCode = err.statusCode || HTTP_CODE.ServerError;
  const message = err.message || 'Something went wrong';

  res.status(statusCode).json({
    error: {
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};

export default errorHandler;
