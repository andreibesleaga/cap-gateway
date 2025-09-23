import { registerCapCalls } from '../controllers/cap.js';
import { schemaValidator } from '../middlewares/schemaValidator.js';
import { jest } from '@jest/globals';

describe('CAP Controller', () => {
  it('should have a registerCapCalls function', () => {
    expect(registerCapCalls).toBeDefined();
  });
});

describe('Schema Validator Middleware', () => {
  it('should return validation errors for invalid XML', async () => {
    const req = {
      body: {
        message: '<invalid></invalid>',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await schemaValidator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'XML does not conform to the Common Alert Protocol 1.2 XSD Schema',
        validationErrors: expect.any(Array),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
