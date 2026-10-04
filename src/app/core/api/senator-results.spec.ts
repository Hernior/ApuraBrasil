import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { parseSenatorEA20, parseGovernorEA20 } from './ea20-parser';
import { parseEA14 } from './ea14-parser';
import { TseApiService } from './tse-api.service';
import { TseUrlBuilderService } from './tse-url-builder.service';
import { senatorConfiguration, senatorElection, senatorFixture } from './senator-test.fixture';
import { governorCitiesFixture, governorFixture, governorTrackingFixture } from './governor-test.fixture';
import { ELECTION_DATA_PROVIDER } from './election-data-provider';
import { ElectionPollingService } from '../services/election-polling.service';
import { PresidentStore } from '../state/president.store';
import { TseRequestError } from './tse-request-error';

describe('Senator data and polling', () => {
  it('keeps two seats, official percentages and both substitutes without declaring leaders elected', () => {
    const result = parseSenatorEA20(senatorFixture(), '43', 1, 'al');
    expect(result.seats).toBe(2); expect(result.officeCode).toBe('5');
    expect(result.validVotes).toBe(200); expect(result.turnout).toBe(100);
    expect(result.candidates[0]?.percentage).toBe(60);
    expect(result.candidates.every(c => c.status === null)).toBeTrue();
    expect(result.candidates[0]?.substitutes?.map(s => s.type)).toEqual(['s1', 's2']);
    const official = senatorFixture(); official.carg[0]!.agr[0]!.par[0]!.cand[0]!.st = 'Eleito';
    expect(parseSenatorEA20(official, '43', 1, 'al').candidates[0]?.status).toBe('Eleito');
  });
  it('rejects another office, scope, second turn and a seat count other than two', () => {
    expect(() => parseSenatorEA20(governorFixture(), '43', 1, 'al')).toThrow();
    expect(() => parseSenatorEA20(senatorFixture(), '43', 1, 'df')).toThrow();
    expect(() => parseSenatorEA20(senatorFixture('al/00001'), '43', 1, 'al/00002')).toThrow();
    expect(() => parseSenatorEA20({ ...senatorFixture(), t: '2' }, '43', 2, 'al')).toThrow();
    const invalid = senatorFixture(); invalid.carg[0]!.nv = '1';
    expect(() => parseSenatorEA20(invalid, '43', 1, 'al')).toThrow();
  });
  it('hides votes before disclosure and rejects duplicate substitute roles', () => {
    const result = parseSenatorEA20({ ...senatorFixture(), dv: 'n' }, '43', 1, 'al');
    expect(result.validVotes).toBeNull(); expect(result.candidates[0]?.percentage).toBeNull();
    const invalid = senatorFixture(); invalid.carg[0]!.agr[0]!.par[0]!.cand[0]!.vs[1]!.tp = 's1';
    expect(() => parseSenatorEA20(invalid, '43', 1, 'al')).toThrow();
  });
  it('builds c0005 URLs and never offers a national or second-turn Senator request', () => {
    const urls = new TseUrlBuilderService();
    expect(urls.senatorUrl(senatorConfiguration, senatorElection, 'al/00001')).toContain('/43/dados/al/al00001-c0005-e000043-u.json');
    expect(() => urls.senatorUrl(senatorConfiguration, senatorElection, 'br')).toThrow();
    expect(() => urls.senatorUrl(senatorConfiguration, { ...senatorElection, round: 2 }, 'al')).toThrow();
  });
  it('loads the selected municipal result and its UF context and uses UF photos', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => new Response(JSON.stringify(String(input).includes('-cm.json') ? governorCitiesFixture() : senatorFixture(String(input).includes('al00001-') ? 'al/00001' : 'al'))));
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    const result = await api.loadSenator(senatorConfiguration, senatorElection, signal, 'al/00001');
    expect(result.candidates[0]?.photoUrl).toContain('/43/fotos/al/');
    expect(fetchSpy.calls.mostRecent().args[0]).toContain('al-c0005-');
    expect(result.stateResult?.scopeCode).toBe('al');
    await expectAsync(api.loadSenator(senatorConfiguration, senatorElection, signal, 'al/00002')).toBeRejected();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
  it('switches cargo in the same election and UF and skips unchanged tracking', fakeAsync(() => {
    const loadGovernor = jasmine.createSpy().and.resolveTo(parseGovernorEA20(governorFixture(), '43', 1, 'al'));
    const loadSenator = jasmine.createSpy().and.resolveTo(parseSenatorEA20(senatorFixture(), '43', 1, 'al'));
    const loadTracking = jasmine.createSpy().and.resolveTo(parseEA14(governorTrackingFixture(), '43', 1, 'al'));
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadGovernor, loadSenator, loadTracking } }] });
    const polling = TestBed.inject(ElectionPollingService), results = TestBed.inject(PresidentStore);
    polling.activate(senatorConfiguration, senatorElection, 'al', '3'); flushMicrotasks();
    polling.activate(senatorConfiguration, senatorElection, 'al', '5');
    expect(results.result()).toBeNull(); flushMicrotasks();
    expect(results.result()?.officeCode).toBe('5');
    tick(15000); flushMicrotasks();
    expect(loadSenator).toHaveBeenCalledTimes(1); expect(loadGovernor).toHaveBeenCalledTimes(1);
    polling.stop();
  }));
  it('preserves the shared 429 cooldown when switching from Senator to Governor', fakeAsync(() => {
    const loadTracking = jasmine.createSpy().and.rejectWith(new TseRequestError(429, 'limited'));
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadTracking } }] });
    const polling = TestBed.inject(ElectionPollingService);
    polling.activate(senatorConfiguration, senatorElection, 'al', '5'); flushMicrotasks();
    polling.activate(senatorConfiguration, senatorElection, 'al', '3'); flushMicrotasks();
    void polling.refresh(); flushMicrotasks();
    expect(loadTracking).toHaveBeenCalledTimes(1); polling.stop();
  }));
  it('ignores a delayed Senator response after returning to Governor in the same election and UF', fakeAsync(() => {
    let complete!: (value: ReturnType<typeof parseSenatorEA20>) => void;
    const loadSenator = jasmine.createSpy().and.returnValue(new Promise(resolve => { complete = resolve; }));
    const governor = parseGovernorEA20(governorFixture(), '43', 1, 'al');
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadSenator, loadGovernor: async () => governor } }] });
    const results = TestBed.inject(PresidentStore);
    void results.load(senatorConfiguration, senatorElection, 'al', '5'); flushMicrotasks();
    void results.load(senatorConfiguration, senatorElection, 'al', '3'); flushMicrotasks();
    complete(parseSenatorEA20(senatorFixture(), '43', 1, 'al')); flushMicrotasks();
    expect(results.result()?.officeCode).toBe('3');
  }));
});
