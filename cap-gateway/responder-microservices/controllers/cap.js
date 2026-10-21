// Mesh handler for { type: 'translate', message, exportJson }. Unexpected errors become a
// { status, error } envelope; details stay in the responder log.
export function createCapController({ service, logger }) {
  return {
    async translate({ message, exportJson }) {
      try {
        return await service.translate(String(message ?? ''), exportJson === true);
      } catch (error) {
        logger.error('translate: internal error: %s', error.stack ?? error);
        return { status: 500, error: 'Internal translation service error' };
      }
    },
  };
}
