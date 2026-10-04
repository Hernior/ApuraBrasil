import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { parseEA12 } from './municipality-parser';
import { parseEA15 } from './ea15-parser';
import { parsePresidentEA20 } from './ea20-parser';
import { presidentFixture, testConfiguration, testElection } from './president-test.fixture';
import { TseUrlBuilderService } from './tse-url-builder.service';
import { TseApiService } from './tse-api.service';
import { ELECTION_DATA_PROVIDER } from './election-data-provider';
import { ElectionPollingService } from '../services/election-polling.service';

export const municipalConfiguration = {
  ...testConfiguration,
  directories: [...testConfiguration.directories, { type: 'cm', template: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/config' }],
  elections: [...testConfiguration.elections, { ...testElection, id: '43', kind: 'state' as const, type: 1 as const, scopes: [{ code: 'br', offices: [] }] }]
};
export function municipalitiesFixture() {
  return { f: 'o', abr: [{ cd: 'al', mu: [{ cd: '00001', cdi: '2700001', nm: 'Cidade teste', c: 's' }] }] };
}
export function municipalTrackingFixture() {
  return { ele: '43', t: '1', f: 'o', idg: '500', abr: [
    { tpabr: 'uf', cdabr: 'al', and: 'p', dt: '', ht: '', s: { st: '50' }, e: {} },
    { tpabr: 'mun', cdabr: '00001', and: 'p', dt: '', ht: '', s: { st: '20' }, e: {} },
    { tpabr: 'mun', cdabr: '00002', and: 'p', dt: '', ht: '', s: { st: '30' }, e: {} }
  ] };
}

describe('President municipal results', () => {
  it('preserves TSE leading zeros and separate IBGE identifiers', () => {
    expect(parseEA12(municipalitiesFixture()).municipalities[0]).toEqual({ uf: 'al', code: '00001', ibgeCode: '2700001', name: 'Cidade teste', capital: true });
    const duplicate = municipalitiesFixture(); duplicate.abr[0]!.mu.push(duplicate.abr[0]!.mu[0]!);
    expect(() => parseEA12(duplicate)).toThrow();
    expect(parseEA12({ f: 'o', abr: [{ cd: 'zz', mu: [{ cd: '00001', cdi: '', nm: 'Exterior', c: 'n' }] }] }).municipalities).toEqual([]);
  });
  it('uses election directories and municipal filename without a separator between UF and code', () => {
    const urls = new TseUrlBuilderService();
    expect(urls.municipalitiesUrl(municipalConfiguration, testElection)).toContain('/42/config/mun-e000042-cm.json');
    expect(urls.presidentUrl(municipalConfiguration, testElection, 'al/00001')).toContain('/42/dados/al/al00001-c0001-e000042-u.json');
    expect(() => urls.presidentUrl(municipalConfiguration, testElection, 'al/1')).toThrow();
  });
  it('validates municipal result scope and preserves disclosure restrictions', () => {
    const data = { ...presidentFixture(), tpabr: 'mu', cdabr: '00001', dv: 'n' };
    const result = parsePresidentEA20(data, '42', 1, 'al/00001');
    expect(result.scopeCode).toBe('al/00001');
    expect(result.candidates.every(c => c.votes === null)).toBeTrue();
    expect(() => parsePresidentEA20(data, '42', 1, 'al/00002')).toThrow();
    expect(() => parsePresidentEA20(presidentFixture(), '42', 1, 'al/00001')).toThrow();
  });
  it('ignores changes in other municipalities and generation id alone', () => {
    const data = municipalTrackingFixture();
    const initial = parseEA15(data, '43', 1, 'al', '00001');
    data.idg = '501'; data.abr[2]!.s.st = '31';
    expect(parseEA15(data, '43', 1, 'al', '00001').signature).toBe(initial.signature);
    data.abr[1]!.s.st = '21';
    expect(parseEA15(data, '43', 1, 'al', '00001').signature).not.toBe(initial.signature);
    expect(initial.national.date).toBeNull();
    expect(() => parseEA15(data, '42', 1, 'al', '00001')).toThrow();
    expect(() => parseEA15(data, '43', 1, 'pe', '00001')).toThrow();
    expect(() => parseEA15(data, '43', 1, 'al', '00003')).toThrow();
  });
  it('loads EA15 from the matching state election and EA20 from the federal election', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => {
      const url = String(input);
      return new Response(JSON.stringify(url.includes('-cm.json') ? municipalitiesFixture() : url.includes('-ab.json') ? municipalTrackingFixture() : { ...presidentFixture(), tpabr: 'mu', cdabr: '00001' }));
    });
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    await api.loadTracking(municipalConfiguration, testElection, signal, 'al/00001');
    await api.loadPresident(municipalConfiguration, testElection, signal, 'al/00001');
    expect(fetchSpy.calls.allArgs().map(a => String(a[0]))).toEqual([
      jasmine.stringMatching('/42/config/mun-e000042-cm.json'),
      jasmine.stringMatching('/43/dados/al/al-e000043-ab.json'),
      jasmine.stringMatching('/42/dados/al/al00001-c0001-e000042-u.json')
    ]);
  });
  it('rejects municipality outside the UF and offers manual updates without a paired election', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify(municipalitiesFixture())));
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    await expectAsync(api.loadPresident(municipalConfiguration, testElection, signal, 'pe/00001')).toBeRejected();
    const tracking = await api.loadTracking({ ...municipalConfiguration, elections: [testElection] }, testElection, signal, 'al/00001');
    expect(tracking.manualNotice).toContain('Atualizar Presidente');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
  it('fetches only the selected municipal result when its marker changes', fakeAsync(() => {
    const data = municipalTrackingFixture();
    const loadTracking = jasmine.createSpy().and.callFake(async () => parseEA15(data, '43', 1, 'al', '00001'));
    const loadPresident = jasmine.createSpy().and.resolveTo(parsePresidentEA20({ ...presidentFixture(), tpabr: 'mu', cdabr: '00001' }, '42', 1, 'al/00001'));
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadTracking, loadPresident } }] });
    const polling = TestBed.inject(ElectionPollingService);
    polling.activate(municipalConfiguration, testElection, 'al/00001'); flushMicrotasks();
    data.abr[2]!.s.st = '31'; tick(15000); flushMicrotasks();
    expect(loadPresident).toHaveBeenCalledTimes(1);
    data.abr[1]!.s.st = '21'; tick(15000); flushMicrotasks();
    expect(loadPresident).toHaveBeenCalledTimes(2);
    expect(loadPresident.calls.mostRecent().args[3]).toBe('al/00001');
    polling.stop();
  }));
  it('keeps the municipal result available in manual mode without a matching EA15', fakeAsync(() => {
    const tracking = { ...parseEA15(municipalTrackingFixture(), '43', 1, 'al', '00001'), manualNotice: 'Use atualização manual.' };
    const loadPresident = jasmine.createSpy().and.resolveTo(parsePresidentEA20({ ...presidentFixture(), tpabr: 'mu', cdabr: '00001' }, '42', 1, 'al/00001'));
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadTracking: async () => tracking, loadPresident } }] });
    const polling = TestBed.inject(ElectionPollingService);
    polling.activate(municipalConfiguration, testElection, 'al/00001'); flushMicrotasks();
    expect(polling.interval()).toBe(0);
    expect(polling.message()).toBe(tracking.manualNotice);
    tick(60000); flushMicrotasks();
    expect(loadPresident).toHaveBeenCalledTimes(1);
    void polling.refresh(); flushMicrotasks();
    expect(loadPresident).toHaveBeenCalledTimes(2);
    polling.stop();
  }));
});
