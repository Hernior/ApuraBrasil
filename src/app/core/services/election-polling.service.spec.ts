import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { parseEA14 } from '../api/ea14-parser';
import { parsePresidentEA20 } from '../api/ea20-parser';
import { presidentFixture, testConfiguration, testElection, trackingFixture } from '../api/president-test.fixture';
import { TseRequestError } from '../api/tse-request-error';
import { ElectionPollingService, resultCoversTracking } from './election-polling.service';

describe('ElectionPollingService', () => {
  let service: ElectionPollingService;
  let provider: { loadTracking: jasmine.Spy; loadPresident: jasmine.Spy };
  let hidden: jasmine.Spy;
  let online: jasmine.Spy;
  beforeEach(() => {
    hidden = spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    online = spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
    const current = new Date(Date.now() - 3 * 3600000).toISOString();
    const result = parsePresidentEA20(presidentFixture(), '42', 1);
    result.generatedDate = current.slice(0, 10).split('-').reverse().join('/');
    result.generatedTime = current.slice(11, 19);
    provider = {
      loadTracking: jasmine.createSpy().and.resolveTo(parseEA14(trackingFixture(), '42', 1)),
      loadPresident: jasmine.createSpy().and.resolveTo(result)
    };
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: provider }] });
    service = TestBed.inject(ElectionPollingService);
  });
  afterEach(() => service.stop());
  it('does not consider local results synchronized until the national decision result covers its marker', () => {
    const result = parsePresidentEA20(presidentFixture(), '42', 1);
    const tracking = parseEA14(trackingFixture(), '42', 1);
    const combined = { ...tracking, nationalTracking: tracking };
    expect(resultCoversTracking(result, combined)).toBeFalse();
    result.nationalResult = { ...result, processedSections: 0 };
    expect(resultCoversTracking(result, combined)).toBeFalse();
    result.nationalResult = { ...result, nationalResult: undefined };
    expect(resultCoversTracking(result, combined)).toBeTrue();
  });
  it('polls EA14 every 15 seconds and skips unchanged EA20 including idg-only updates', fakeAsync(() => {
    service.activate(testConfiguration, testElection); flushMicrotasks();
    tick(15000); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    expect(provider.loadPresident).toHaveBeenCalledTimes(1);
    expect(service.live()).toBeTrue();
    service.stop();
  }));
  it('fetches EA20 after changes and keeps retrying if CDN still serves the previous result', fakeAsync(() => {
    service.activate(testConfiguration, testElection); flushMicrotasks();
    const changed = trackingFixture(); changed.abr[0]!.ht = '17:01:00';
    provider.loadTracking.and.resolveTo(parseEA14(changed, '42', 1));
    tick(15000); flushMicrotasks();
    expect(service.message()).toContain('sincronização');
    tick(15000); flushMicrotasks();
    expect(provider.loadPresident).toHaveBeenCalledTimes(3);
    const result = presidentFixture(); result.idg = '124'; result.ht = '17:01:00';
    provider.loadPresident.and.resolveTo(parsePresidentEA20(result, '42', 1));
    tick(15000); flushMicrotasks(); tick(15000); flushMicrotasks();
    expect(provider.loadPresident).toHaveBeenCalledTimes(4);
    service.stop();
  }));
  it('supports manual mode and forces refresh despite unchanged tracking', fakeAsync(() => {
    service.activate(testConfiguration, testElection); flushMicrotasks();
    service.setInterval(0); tick(60000); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    void service.refresh(); flushMicrotasks();
    expect(provider.loadPresident).toHaveBeenCalledTimes(2);
    service.stop();
  }));
  it('pauses when hidden and refreshes immediately on return', fakeAsync(() => {
    service.activate(testConfiguration, testElection); flushMicrotasks();
    hidden.and.returnValue(true); document.dispatchEvent(new Event('visibilitychange'));
    tick(60000); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    hidden.and.returnValue(false); document.dispatchEvent(new Event('visibilitychange')); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    service.stop();
  }));
  it('does not call the TSE offline and refreshes on reconnection', fakeAsync(() => {
    online.and.returnValue(false); service.activate(testConfiguration, testElection); flushMicrotasks();
    expect(provider.loadTracking).not.toHaveBeenCalled();
    online.and.returnValue(true); window.dispatchEvent(new Event('online')); flushMicrotasks();
    expect(provider.loadPresident).toHaveBeenCalledTimes(1);
    service.stop();
  }));
  it('honours 429 cooldown for manual refresh and visibility changes too', fakeAsync(() => {
    provider.loadTracking.and.rejectWith(new TseRequestError(429, 'limited', 700000));
    service.activate(testConfiguration, testElection); flushMicrotasks();
    void service.refresh(); flushMicrotasks();
    hidden.and.returnValue(true); document.dispatchEvent(new Event('visibilitychange'));
    hidden.and.returnValue(false); document.dispatchEvent(new Event('visibilitychange')); flushMicrotasks();
    tick(699999); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    tick(1); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    expect(service.message()).toContain('10 minutos');
    service.stop();
  }));
  it('backs off network errors exponentially and does not overlap requests', fakeAsync(() => {
    provider.loadTracking.and.rejectWith(new TypeError('network'));
    service.activate(testConfiguration, testElection); flushMicrotasks();
    tick(29999); flushMicrotasks(); expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    tick(1); flushMicrotasks(); expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    tick(59999); flushMicrotasks(); expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    tick(1); flushMicrotasks(); expect(provider.loadTracking).toHaveBeenCalledTimes(3);
    service.stop();
  }));
  it('enforces allowed intervals and stops timers on destruction', fakeAsync(() => {
    service.activate(testConfiguration, testElection); flushMicrotasks();
    expect(() => service.setInterval(5000)).toThrow();
    service.setInterval(30000); tick(29999); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    tick(1); flushMicrotasks(); expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    service.stop(); tick(120000); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(2);
  }));
  it('blocks too-frequent 404 attempts and suspends automatic updates on invalid layout', fakeAsync(() => {
    provider.loadTracking.and.rejectWith(new TseRequestError(404, 'unavailable'));
    service.activate(testConfiguration, testElection); flushMicrotasks();
    tick(59999); flushMicrotasks(); expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    provider.loadTracking.and.rejectWith(new Error('Invalid layout'));
    tick(1); flushMicrotasks(); expect(service.interval()).toBe(0);
    tick(120000); flushMicrotasks(); expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    service.stop();
  }));
  it('requires the EA20 to cover the tracking timestamp, sections and finalization', () => {
    const result = parsePresidentEA20(presidentFixture(), '42', 1);
    const tracking = parseEA14(trackingFixture(), '42', 1);
    expect(resultCoversTracking(result, tracking)).toBeTrue();
    expect(resultCoversTracking({ ...result, processedSections: 49 }, tracking)).toBeFalse();
    expect(resultCoversTracking({ ...result, totalizationTime: '16:58:00' }, tracking)).toBeFalse();
    expect(resultCoversTracking(result, { ...tracking, national: { ...tracking.national, progress: 'f' } })).toBeFalse();
  });

  it('prevents overlapping checks and aborts requests while hidden', fakeAsync(() => {
    let captured!: AbortSignal;
    provider.loadTracking.and.callFake((_config: unknown, _election: unknown, signal: AbortSignal) => {
      captured = signal;
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    });
    service.activate(testConfiguration, testElection);
    void service.refresh(); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    hidden.and.returnValue(true); document.dispatchEvent(new Event('visibilitychange')); flushMicrotasks();
    expect(captured.aborted).toBeTrue();
    tick(60000); expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    service.stop();
  }));
  it('times out EA14 and retries after backoff', fakeAsync(() => {
    provider.loadTracking.and.callFake((_config: unknown, _election: unknown, signal: AbortSignal) =>
      new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    service.activate(testConfiguration, testElection);
    tick(15000); flushMicrotasks();
    expect(service.checking()).toBeFalse();
    expect(service.message()).toContain('intervalo maior');
    tick(30000); expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    service.stop(); flushMicrotasks();
  }));
  it('also pauses after HTTP 429 from EA20', fakeAsync(() => {
    provider.loadPresident.and.rejectWith(new TseRequestError(429, 'limited'));
    service.activate(testConfiguration, testElection); flushMicrotasks();
    void service.refresh(); flushMicrotasks();
    tick(599999); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(1);
    tick(1); flushMicrotasks();
    expect(provider.loadTracking).toHaveBeenCalledTimes(2);
    service.stop();
  }));
  it('does not mark old files live and expires the label without new results', fakeAsync(() => {
    provider.loadPresident.and.resolveTo(parsePresidentEA20({ ...presidentFixture(), dg: '01/01/2020' }, '42', 1));
    service.activate(testConfiguration, testElection); flushMicrotasks();
    expect(service.live()).toBeFalse();
    service.stop();
  }));
});
