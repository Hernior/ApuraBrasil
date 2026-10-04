import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { parseFederalDeputyEA20, parseSenatorEA20 } from './ea20-parser';
import { parseEA14 } from './ea14-parser';
import { parseEA15 } from './ea15-parser';
import { deputyConfiguration, deputyElection, deputyFixture } from './federal-deputy-test.fixture';
import { governorCitiesFixture, governorTrackingFixture } from './governor-test.fixture';
import { municipalTrackingFixture } from './municipal-results.spec';
import { senatorFixture } from './senator-test.fixture';
import { TseApiService } from './tse-api.service';
import { TseUrlBuilderService } from './tse-url-builder.service';
import { ELECTION_DATA_PROVIDER } from './election-data-provider';
import { ElectionPollingService, resultCoversTracking } from '../services/election-polling.service';
import { PresidentStore } from '../state/president.store';
import { TseRequestError } from './tse-request-error';

describe('Federal deputy UF and municipal results', () => {
  it('rejects wrong scope, election, cargo and second turn, preserves leading-zero municipal URL', () => {
    const urls = new TseUrlBuilderService();
    expect(urls.federalDeputyUrl(deputyConfiguration, deputyElection, 'al/00001')).toContain('/al/al00001-c0006-e000043-u.json');
    expect(() => urls.federalDeputyUrl(deputyConfiguration, deputyElection, 'br')).toThrow();
    expect(() => urls.federalDeputyUrl(deputyConfiguration, { ...deputyElection, round: 2 }, 'al')).toThrow();
    expect(() => parseFederalDeputyEA20(deputyFixture(), '42', 1, 'al')).toThrow();
    expect(() => parseFederalDeputyEA20(deputyFixture(), '43', 1, 'df')).toThrow();
    expect(() => parseFederalDeputyEA20(senatorFixture(), '43', 1, 'al')).toThrow();
  });
  it('loads municipality votes plus exactly one UF result for seats and UF photos', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => {
      const url = String(input);
      return new Response(JSON.stringify(url.includes('-cm.json') ? governorCitiesFixture() : deputyFixture(url.includes('al00001-') ? 'al/00001' : 'al')));
    });
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    const result = await api.loadFederalDeputy(deputyConfiguration, deputyElection, signal, 'al/00001');
    expect(result.allocation).toBeUndefined(); expect(result.stateResult?.allocation?.winners.length).toBe(3);
    expect(result.candidates[0]?.photoUrl).toContain('/fotos/al/');
    expect(fetchSpy.calls.allArgs().map(args => String(args[0]))).toEqual([
      jasmine.stringMatching('/43/config/mun-e000043-cm.json'), jasmine.stringMatching('/al/al00001-c0006-'), jasmine.stringMatching('/al/al-c0006-')
    ]);
    await expectAsync(api.loadFederalDeputy(deputyConfiguration, deputyElection, signal, 'al/00002')).toBeRejected();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
  it('tracks both the selected municipality and the UF, ignores unrelated UF changes', async () => {
    const state = governorTrackingFixture(), local = municipalTrackingFixture();
    spyOn(window, 'fetch').and.callFake(async input => new Response(JSON.stringify(String(input).includes('-cm.json') ? governorCitiesFixture() : String(input).includes('/dados/br/') ? state : local)));
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    const first = await api.loadTracking(deputyConfiguration, deputyElection, signal, 'al/00001', '6');
    expect(first.stateTracking?.national.processedSections).toBe(50);
    state.abr[1]!.s.st = '51';
    expect((await api.loadTracking(deputyConfiguration, deputyElection, signal, 'al/00001', '6')).signature).toBe(first.signature);
    state.abr[0]!.s.st = '51';
    expect((await api.loadTracking(deputyConfiguration, deputyElection, signal, 'al/00001', '6')).signature).not.toBe(first.signature);
  });
  it('does not accept a municipal snapshot while its statewide result is behind tracking', () => {
    const result = parseFederalDeputyEA20(deputyFixture('al/00001'), '43', 1, 'al/00001');
    result.stateResult = parseFederalDeputyEA20(deputyFixture(), '43', 1, 'al');
    const tracking = { ...parseEA15(municipalTrackingFixture(), '43', 1, 'al', '00001'), stateTracking: parseEA14(governorTrackingFixture(), '43', 1, 'al') };
    expect(resultCoversTracking(result, tracking)).toBeTrue();
    result.stateResult.processedSections = 49;
    expect(resultCoversTracking(result, tracking)).toBeFalse();
  });
  it('updates allocation when only the statewide generation changes', fakeAsync(() => {
    const local = parseEA15(municipalTrackingFixture(), '43', 1, 'al', '00001');
    const state = parseEA14(governorTrackingFixture(), '43', 1, 'al');
    let changed = false;
    const loadFederalDeputy = jasmine.createSpy().and.callFake(async () => {
      const result = parseFederalDeputyEA20(deputyFixture('al/00001'), '43', 1, 'al/00001');
      result.stateResult = parseFederalDeputyEA20(deputyFixture(), '43', 1, 'al');
      if (changed) result.stateResult.generationId = '501';
      return result;
    });
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadFederalDeputy, loadTracking: async () => ({ ...local, stateTracking: state, signature: changed ? 'new-state' : 'original-state' }) } }] });
    const polling = TestBed.inject(ElectionPollingService);
    polling.activate(deputyConfiguration, deputyElection, 'al/00001', '6'); flushMicrotasks();
    changed = true; tick(15000); flushMicrotasks();
    expect(loadFederalDeputy).toHaveBeenCalledTimes(2); expect(polling.message()).toBeNull();
    tick(15000); flushMicrotasks(); expect(loadFederalDeputy).toHaveBeenCalledTimes(2); polling.stop();
  }));
  it('cancels a delayed deputy result when switching cargo and preserves shared cooldown', fakeAsync(() => {
    let complete!: (result: ReturnType<typeof parseFederalDeputyEA20>) => void;
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: {
      loadFederalDeputy: () => new Promise(resolve => { complete = resolve; }), loadSenator: async () => parseSenatorEA20(senatorFixture(), '43', 1, 'al'),
      loadTracking: jasmine.createSpy().and.rejectWith(new TseRequestError(429, 'limited'))
    } }] });
    const results = TestBed.inject(PresidentStore);
    void results.load(deputyConfiguration, deputyElection, 'al', '6'); flushMicrotasks();
    void results.load(deputyConfiguration, deputyElection, 'al', '5'); flushMicrotasks();
    complete(parseFederalDeputyEA20(deputyFixture(), '43', 1, 'al')); flushMicrotasks();
    expect(results.result()?.officeCode).toBe('5');
    const polling = TestBed.inject(ElectionPollingService);
    polling.activate(deputyConfiguration, deputyElection, 'al', '6'); flushMicrotasks();
    polling.activate(deputyConfiguration, deputyElection, 'al', '5'); flushMicrotasks();
    expect(TestBed.inject(ELECTION_DATA_PROVIDER).loadTracking).toHaveBeenCalledTimes(1); polling.stop();
  }));
});
