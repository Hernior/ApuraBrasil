import { TestBed } from '@angular/core/testing';
import { TseApiService } from './tse-api.service';
import { TseParserService } from './tse-parser.service';

describe('TseApiService configuration', () => {
  let api: TseApiService;
  let fetchSpy: jasmine.Spy;
  const signal = new AbortController().signal;
  beforeEach(() => {
    api = TestBed.inject(TseApiService);
    fetchSpy = spyOn(window, 'fetch');
  });
  it('passes cancellation and bypasses stale browser cache', async () => {
    const config = { generatedDate: '04/10/2026', generatedTime: '17:00:00',
      generationId: '1', phase: 'o' as const, directories: [], elections: [] };
    spyOn(TestBed.inject(TseParserService), 'parseEA11').and.returnValue(config);
    fetchSpy.and.resolveTo(new Response('{}', { status: 200 }));
    expect(await api.loadConfiguration(signal)).toEqual(config);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
      { signal, credentials: 'omit', cache: 'no-cache' }
    );
  });
  for (const status of [404, 429, 500]) {
    it(`reports HTTP ${status} without automatic retries`, async () => {
      fetchSpy.and.resolveTo(new Response('', { status }));
      await expectAsync(api.loadConfiguration(signal)).toBeRejectedWithError(new RegExp(String(status)));
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  }
});
