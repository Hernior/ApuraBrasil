import { parseEA14 } from './ea14-parser';
import { parsePresidentEA20 } from './ea20-parser';
import { presidentFixture, trackingFixture, testConfiguration, testElection } from './president-test.fixture';
import { TseUrlBuilderService } from './tse-url-builder.service';
import { TestBed } from '@angular/core/testing';
import { TseApiService } from './tse-api.service';

describe('President UF results', () => {
  it('uses UF in directory and filename and keeps President photos in the official BR directory', () => {
    const urls = new TseUrlBuilderService();
    expect(urls.presidentUrl(testConfiguration, testElection, 'al'))
      .toBe('https://resultados.tse.jus.br/oficial/ele2026/42/dados/al/al-c0001-e000042-u.json');
    expect(urls.candidatePhotoUrl(testConfiguration, testElection, '901')).toContain('/fotos/br/');
    expect(() => urls.presidentUrl(testConfiguration, testElection, '../al')).toThrow();
    expect(() => urls.presidentUrl(testConfiguration, testElection, 'zz')).toThrow();
  });
  it('validates the exact expected UF and rejects national results in a UF view', () => {
    const data = { ...presidentFixture(), tpabr: 'uf', cdabr: 'al' };
    expect(parsePresidentEA20(data, '42', 1, 'al').scopeCode).toBe('al');
    expect(() => parsePresidentEA20(data, '42', 1, 'pe')).toThrow();
    expect(() => parsePresidentEA20(presidentFixture(), '42', 1, 'al')).toThrow();
  });
  it('discovers states from EA14 and ignores changes to other scopes while watching AL', () => {
    const data = trackingFixture();
    const initial = parseEA14(data, '42', 1, 'al');
    expect(initial.availableStates).toEqual(['al']);
    expect(initial.national.processedSections).toBe(10);
    data.abr[0]!.ht = '17:01:00';
    expect(parseEA14(data, '42', 1, 'al').signature).toBe(initial.signature);
    data.abr[1]!.ht = '17:02:00';
    expect(parseEA14(data, '42', 1, 'al').signature).not.toBe(initial.signature);
  });
  it('propagates the UF through the API and refuses mismatched payloads', async () => {
    const api = TestBed.inject(TseApiService);
    const data = { ...presidentFixture(), tpabr: 'uf', cdabr: 'al' };
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(data)));
    const result = await api.loadPresident(testConfiguration, testElection, new AbortController().signal, 'al');
    expect(result.scopeCode).toBe('al');
    expect(fetchSpy.calls.mostRecent().args[0]).toContain('/dados/al/al-c0001-');
    fetchSpy.and.resolveTo(new Response(JSON.stringify(data)));
    await expectAsync(api.loadPresident(testConfiguration, testElection, new AbortController().signal, 'pe')).toBeRejected();
  });
});
