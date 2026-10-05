import { TestBed } from '@angular/core/testing';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { ElectionConfiguration } from '../models/election.model';
import { ElectionStore } from './election.store';

describe('ElectionStore', () => {
  const config: ElectionConfiguration = {
    generatedDate: '04/10/2026', generatedTime: '17:00:00', generationId: '1',
    phase: 'o', directories: [], elections: []
  };
  let provider: { loadConfiguration: jasmine.Spy };
  let store: ElectionStore;
  beforeEach(() => {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
    provider = { loadConfiguration: jasmine.createSpy().and.resolveTo(config) };
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: provider }] });
    store = TestBed.inject(ElectionStore);
  });
  it('loads once and does not overlap requests', async () => {
    const pending = store.load();
    await store.load();
    expect(provider.loadConfiguration).toHaveBeenCalledTimes(1);
    await pending;
    expect(store.configuration()).toEqual(config);
    expect(store.loading()).toBeFalse();
  });
  it('retains the last configuration if manual refresh fails', async () => {
    await store.load();
    provider.loadConfiguration.and.rejectWith(new Error('HTTP 429'));
    await store.load();
    expect(store.configuration()).toEqual(config);
    expect(store.error()).toBe('HTTP 429');
  });
  it('does not request data offline', async () => {
    (Object.getOwnPropertyDescriptor(navigator, 'onLine')?.get as jasmine.Spy).and.returnValue(false);
    await store.load();
    expect(provider.loadConfiguration).not.toHaveBeenCalled();
    expect(store.error()).toContain('offline');
  });
  it('aborts the in-flight request on cancellation', async () => {
    provider.loadConfiguration.and.callFake((signal: AbortSignal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const pending = store.load();
    store.cancel();
    await pending;
    expect(store.error()).toContain('interrompida');
    expect(store.loading()).toBeFalse();
  });
});
