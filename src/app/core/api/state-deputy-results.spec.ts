import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { parseStateDeputyEA20 } from './ea20-parser';
import { stateDeputyConfiguration, stateDeputyElection, stateDeputyFixture } from './state-deputy-test.fixture';
import { governorCitiesFixture, governorTrackingFixture } from './governor-test.fixture';
import { TseUrlBuilderService } from './tse-url-builder.service';
import { TseApiService } from './tse-api.service';
import { ELECTION_DATA_PROVIDER } from './election-data-provider';
import { PresidentStore } from '../state/president.store';
import { ElectionPollingService } from '../services/election-polling.service';
import { TseRequestError } from './tse-request-error';

describe('State and district deputy results', () => {
  it('uses cargo 7 in states and cargo 8 exclusively in DF, preserving EA20 seats and disclosure', () => {
    const state = parseStateDeputyEA20(stateDeputyFixture(), '43', 1, 'al');
    const district = parseStateDeputyEA20(stateDeputyFixture('df'), '43', 1, 'df');
    expect(state.officeCode).toBe('7'); expect(district.officeCode).toBe('8');
    expect(state.allocation?.groups.map(g => g.seats)).toEqual([2, 1, 0]);
    expect(district.allocation?.winners).toEqual(state.allocation?.winners);
    expect(parseStateDeputyEA20(stateDeputyFixture('df', 24), '43', 1, 'df').seats).toBe(24);
    const hidden = stateDeputyFixture(); hidden.dv = 'n';
    expect(parseStateDeputyEA20(hidden, '43', 1, 'al').allocation?.winners).toEqual([]);
  });
  it('rejects federal cargo, district cargo in a state, state cargo in DF and a second turn', () => {
    const invalid = stateDeputyFixture(); invalid.carg[0]!.cd = '8';
    expect(() => parseStateDeputyEA20(invalid, '43', 1, 'al')).toThrow();
    invalid.carg[0]!.cd = '6'; expect(() => parseStateDeputyEA20(invalid, '43', 1, 'al')).toThrow();
    const district = stateDeputyFixture('df'); district.carg[0]!.cd = '7';
    expect(() => parseStateDeputyEA20(district, '43', 1, 'df')).toThrow();
    expect(() => parseStateDeputyEA20(stateDeputyFixture(), '43', 2, 'al')).toThrow();
    expect(() => parseStateDeputyEA20(stateDeputyFixture(), '43', 1, 'br')).toThrow();
  });
  it('uses the right cargo in UF and municipal URLs and requires it to exist in EA11', () => {
    const urls = new TseUrlBuilderService();
    expect(urls.stateDeputyUrl(stateDeputyConfiguration, stateDeputyElection, 'al/00001')).toContain('/al/al00001-c0007-e000043-u.json');
    expect(urls.stateDeputyUrl(stateDeputyConfiguration, stateDeputyElection, 'df/97012')).toContain('/df/df97012-c0008-e000043-u.json');
    const stateOnly = { ...stateDeputyElection, scopes: [{ code: 'br', offices: [{ code: '7', name: 'Deputado Estadual', type: 2 }] }] };
    expect(() => urls.stateDeputyUrl(stateDeputyConfiguration, stateOnly, 'df')).toThrow();
    expect(() => urls.stateDeputyUrl(stateDeputyConfiguration, { ...stateDeputyElection, round: 2 }, 'al')).toThrow();
    expect(() => urls.stateDeputyUrl(stateDeputyConfiguration, stateDeputyElection, 'zz')).toThrow();
  });
  it('loads district municipality votes and the DF result for allocation, with UF photos', async () => {
    const fetchSpy = spyOn(window, 'fetch').and.callFake(async input => new Response(JSON.stringify(String(input).includes('-cm.json') ? governorCitiesFixture() : stateDeputyFixture(String(input).includes('df97012-') ? 'df/97012' : 'df'))));
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    const result = await api.loadStateDeputy(stateDeputyConfiguration, stateDeputyElection, signal, 'df/97012');
    expect(result.officeCode).toBe('8'); expect(result.stateResult?.scopeCode).toBe('df');
    expect(result.stateResult?.allocation?.winners.length).toBe(3); expect(result.allocation).toBeUndefined();
    expect(result.candidates[0]?.photoUrl).toContain('/fotos/df/');
    expect(fetchSpy.calls.allArgs().map(args => String(args[0]))).toEqual([
      jasmine.stringMatching('/43/config/mun-e000043-cm.json'), jasmine.stringMatching('/df/df97012-c0008-'), jasmine.stringMatching('/df/df-c0008-')
    ]);
    await expectAsync(api.loadStateDeputy(stateDeputyConfiguration, stateDeputyElection, signal, 'df/00001')).toBeRejected();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
  it('includes the statewide marker in municipal tracking for both state and district cargo', async () => {
    const state = governorTrackingFixture();
    spyOn(window, 'fetch').and.callFake(async input => {
      const url = String(input), uf = url.includes('/dados/df/') ? 'df' : 'al';
      const local = { ...state, abr: [{ ...state.abr[0]!, cdabr: uf }, { ...state.abr[0]!, tpabr: 'mun', cdabr: uf === 'df' ? '97012' : '00001' }] };
      return new Response(JSON.stringify(url.includes('-cm.json') ? governorCitiesFixture() : url.includes('/dados/br/') ? state : local));
    });
    const api = TestBed.inject(TseApiService), signal = new AbortController().signal;
    const initial = await api.loadTracking(stateDeputyConfiguration, stateDeputyElection, signal, 'al/00001', '7');
    expect(initial.stateTracking?.national.processedSections).toBe(50);
    state.abr[0]!.s.st = '51';
    expect((await api.loadTracking(stateDeputyConfiguration, stateDeputyElection, signal, 'al/00001', '7')).signature).not.toBe(initial.signature);
    expect((await api.loadTracking(stateDeputyConfiguration, stateDeputyElection, signal, 'df/97012', '8')).stateTracking?.national.processedSections).toBe(50);
  });
  it('does not overwrite state deputy results with an old district response and respects shared 429 cooldown', fakeAsync(() => {
    let complete!: (result: ReturnType<typeof parseStateDeputyEA20>) => void;
    const loadTracking = jasmine.createSpy().and.rejectWith(new TseRequestError(429, 'limited'));
    const loadStateDeputy = jasmine.createSpy().and.callFake((_c, _e, _s, scope: string) => scope === 'df' ? new Promise(resolve => { complete = resolve; }) : Promise.resolve(parseStateDeputyEA20(stateDeputyFixture(), '43', 1, 'al')));
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadStateDeputy, loadTracking } }] });
    const store = TestBed.inject(PresidentStore);
    void store.load(stateDeputyConfiguration, stateDeputyElection, 'df', '8'); flushMicrotasks();
    void store.load(stateDeputyConfiguration, stateDeputyElection, 'al', '7'); flushMicrotasks();
    complete(parseStateDeputyEA20(stateDeputyFixture('df'), '43', 1, 'df')); flushMicrotasks();
    expect(store.result()?.officeCode).toBe('7');
    const polling = TestBed.inject(ElectionPollingService);
    polling.activate(stateDeputyConfiguration, stateDeputyElection, 'al', '7'); flushMicrotasks();
    polling.activate(stateDeputyConfiguration, stateDeputyElection, 'df', '8'); flushMicrotasks();
    expect(loadTracking).toHaveBeenCalledTimes(1); polling.stop();
  }));
});
