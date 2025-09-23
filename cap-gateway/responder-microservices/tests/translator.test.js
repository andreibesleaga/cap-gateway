import axios from 'axios';
import * as translators from '../services/translator.js';

jest.mock('axios');

describe('Translator Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should translate text with LibreTranslate', async () => {
    const mockResponse = { data: { translatedText: 'hola' } };
    axios.post.mockResolvedValue(mockResponse);

    const result = await translators.translateWithLibre('hello', 'en', 'es');

    expect(result).toBe('hola');
    expect(axios.post).toHaveBeenCalledWith('https://libretranslate.com/translate', {
      q: 'hello',
      source: 'en',
      target: 'es',
      format: 'text',
    });
  });

  it('should throw an error if LibreTranslate fails', async () => {
    axios.post.mockRejectedValue(new Error('Network error'));
    await expect(translators.translateWithLibre('hello', 'en', 'es')).rejects.toThrow('LibreTranslate failed');
  });
});
