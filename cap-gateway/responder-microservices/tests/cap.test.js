import CapService from '../services/cap.js';
import * as translators from '../services/translator.js';

jest.mock('../services/translator.js', () => ({
  translateWithLibre: jest.fn(),
  translateWithYandex: jest.fn().mockResolvedValue('translated text'),
}));

describe('CAP Service', () => {
  it('should have a translate function', () => {
    expect(CapService.translate).toBeDefined();
  });

  it('should use the specified translator', async () => {
    const xml = '<alert><info><language>de</language><description>test</description></info></alert>';
    await CapService.translate(xml, false, 'translateWithYandex');
    expect(translators.translateWithYandex).toHaveBeenCalled();
  });
});
