import { TestBed } from '@angular/core/testing';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { parsePresidentEA20 } from '../api/ea20-parser';
import { presidentFixture, testConfiguration, testElection } from '../api/president-test.fixture';
import { PresidentStore } from './president.store';
import { ElectionResult } from '../models/election-result.model';
import { ElectionHistoryService } from '../services/election-history.service';

describe('PresidentStore', () => {
  let store: PresidentStore;
  let load: jasmine.Spy;
  let record: jasmine.Spy;
  const result = () => parsePresidentEA20(presidentFixture(), '42', 1);
  beforeEach(() => {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
    load = jasmine.createSpy().and.resolveTo(result());
    record = jasmine.createSpy().and.resolveTo(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadPresident: load } },
      { provide: ElectionHistoryService, useValue: { record } }] });
    store = TestBed.inject(PresidentStore);
  });
  it('preserves the previous data on failed manual refresh', async () => {
    await store.load(testConfiguration, testElection);
    load.and.rejectWith(new Error('HTTP 429'));
    await store.load(testConfiguration, testElection);
    expect(store.result()?.electionId).toBe('42');
    expect(store.error()).toBe('HTTP 429');
    expect(store.loading()).toBeFalse();
    expect(record).toHaveBeenCalledTimes(1);
  });
  it('clears old results when the selected election changes and its request fails', async () => {
    await store.load(testConfiguration, testElection);
    load.and.rejectWith(new Error('HTTP 404'));
    await store.load(testConfiguration, { ...testElection, id: '43', round: 2 });
    expect(store.result()).toBeNull();
  });
  it('ignores outdated responses even if the provider does not honour cancellation', async () => {
    let resolveFirst!: (result: ElectionResult) => void;
    load.and.returnValue(new Promise<ElectionResult>(resolve => { resolveFirst = resolve; }));
    const first = store.load(testConfiguration, testElection);
    load.and.resolveTo({ ...result(), generationId: '200' });
    await store.load(testConfiguration, testElection);
    resolveFirst(result()); await first;
    expect(store.result()?.generationId).toBe('200');
    expect(record).toHaveBeenCalledTimes(1); expect(record.calls.mostRecent().args[0].generationId).toBe('200');
  });
  it('records accepted data without waiting for local persistence', async () => {
    record.and.returnValue(new Promise<void>(() => {}));
    expect(await store.load(testConfiguration, testElection)).toBeTrue();
    expect(store.result()).not.toBeNull(); expect(record).toHaveBeenCalledOnceWith(store.result());
  });
});
