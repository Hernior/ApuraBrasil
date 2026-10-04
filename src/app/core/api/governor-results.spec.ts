import { TestBed } from '@angular/core/testing';
import { parseGovernorEA20 } from './ea20-parser';
import { TseApiService } from './tse-api.service';
import { TseUrlBuilderService } from './tse-url-builder.service';
import { governorCitiesFixture, governorConfiguration, governorElection, governorFixture, governorTrackingFixture } from './governor-test.fixture';
import { testElection, presidentFixture } from './president-test.fixture';

describe('Governor official data contract', () => {
  it('builds state and municipal URLs and uses state photos, including DF', () => {
    const urls = new TseUrlBuilderService();
    expect(urls.governorUrl(governorConfiguration, governorElection, 'al')).toContain('/43/dados/al/al-c0003-e000043-u.json');
    expect(urls.governorUrl(governorConfiguration, governorElection, 'al/00001')).toContain('/al/al00001-c0003-e000043-u.json');
    expect(urls.governorUrl(governorConfiguration, governorElection, 'df')).toContain('/df/df-c0003-');
    expect(urls.candidatePhotoUrl(governorConfiguration, governorElection, '901', 'al')).toContain('/43/fotos/al/901.jpeg');
    for (const scope of ['br', 'zz', 'al/1', '../al']) expect(() => urls.governorUrl(governorConfiguration, governorElection, scope)).toThrow();
    expect(() => urls.governorUrl(governorConfiguration, testElection, 'al')).toThrow();
    expect(() => urls.governorUrl(governorConfiguration, { ...governorElection, scopes: [{ code: 'df', offices: governorElection.scopes[0]!.offices }] }, 'al')).toThrow();
  });
  it('rejects another office, election, turn, UF or municipality', () => {
    expect(parseGovernorEA20(governorFixture(), '43', 1, 'al').officeCode).toBe('3');
    expect(() => parseGovernorEA20(presidentFixture(), '42', 1, 'al')).toThrow();
    expect(() => parseGovernorEA20({ ...governorFixture(), carg: presidentFixture().carg }, '43', 1, 'al')).toThrow();
    expect(() => parseGovernorEA20(governorFixture(), '42', 1, 'al')).toThrow();
    expect(() => parseGovernorEA20(governorFixture(), '43', 2, 'al')).toThrow();
    expect(() => parseGovernorEA20(governorFixture(), '43', 1, 'df')).toThrow();
    expect(() => parseGovernorEA20(governorFixture('al/00001'), '43', 1, 'al/00002')).toThrow();
    expect(() => parseGovernorEA20(governorFixture(), '43', 1, 'br')).toThrow();
  });
  it('supports the discovered second round and preserves official statuses without inferring winners', () => {
    const data = { ...governorFixture(), ele: '44', t: '2' };
    const result = parseGovernorEA20(data, '44', 2, 'al');
    expect(result.round).toBe(2);
    expect(result.candidates.find(c => c.id === '901')?.status).toBeNull();
  });
  it('hides all votes while disclosure is forbidden', () => {
    const result = parseGovernorEA20({ ...governorFixture(), dv: 'n' }, '43', 1, 'al');
    expect(result.validVotes).toBeNull();
    expect(result.candidates.every(c => c.votes === null && c.percentage === null)).toBeTrue();
  });
  it('validates geographic membership and fetches only the selected state result', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => new Response(JSON.stringify(String(input).includes('-cm.json') ? governorCitiesFixture() : governorFixture())));
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    const result = await api.loadGovernor(governorConfiguration, governorElection, signal, 'al');
    expect(result.candidates[0]?.photoUrl).toContain('/fotos/al/');
    await expectAsync(api.loadGovernor(governorConfiguration, governorElection, signal, 'xx')).toBeRejected();
    await expectAsync(api.loadGovernor(governorConfiguration, governorElection, signal, 'al/00002')).toBeRejected();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
  it('uses the same state election for EA15 and municipal Governor EA20', async () => {
    const tracking = governorTrackingFixture();
    const municipal = { ...tracking, abr: [...tracking.abr, { ...tracking.abr[0]!, tpabr: 'mun', cdabr: '00001' }] };
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => new Response(JSON.stringify(String(input).includes('-cm.json') ? governorCitiesFixture() : String(input).includes('-ab.json') ? municipal : governorFixture('al/00001'))));
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    const marker = await api.loadTracking(governorConfiguration, governorElection, signal, 'al/00001');
    const result = await api.loadGovernor(governorConfiguration, governorElection, signal, 'al/00001');
    expect(marker.electionId).toBe('43'); expect(result.scopeCode).toBe('al/00001');
    expect(fetchSpy.calls.allArgs().map(a => String(a[0]))).toEqual([
      jasmine.stringMatching('/43/config/'), jasmine.stringMatching('/43/dados/al/al-e000043-ab.json'), jasmine.stringMatching('/43/dados/al/al00001-c0003-e000043-u.json')
    ]);
  });
});
