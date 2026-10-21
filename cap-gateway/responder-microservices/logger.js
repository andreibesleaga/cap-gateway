import { createLogger, format, transports } from 'winston';

// Console logger; LOG_LEVEL (error, warn, info, debug) defaults to info
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.splat(), format.simple()),
  transports: [new transports.Console()],
});

export default logger;
