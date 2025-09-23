import CapService from '../services/cap.js';

class CapController {

  async translate(req) {
    const {
      message,
      exportJson,
      translator
    } = req;
    try {
      const result = await CapService.translate(
        message, exportJson, translator
      );
      return result;
    } catch (error) {
      return {
        error: {
          message: error.message,
          stack: error.stack,
        },
        status: 500,
      };
    }
  }

}

export default new CapController();