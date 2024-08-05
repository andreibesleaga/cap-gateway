import CapService from '../services/cap.js';

class CapController {

  async translate(req) {
    const {
      message,
      exportJson
    } = req;
    try {
      const result = await CapService.translate(
        message, exportJson
      );
      return result;
    } catch (err) {
      return err;
    }
  }

}

export default new CapController();