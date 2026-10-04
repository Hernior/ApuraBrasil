import { TestBed } from '@angular/core/testing';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { parsePresidentEA20 } from '../api/ea20-parser';
import { presidentFixture, testConfiguration, testElection } from '../api/president-test.fixture';
import { PresidentStore } from './president.store';
import { ElectionResult } from '../models/election-result.model';

describe('PresidentStore', () => {
  let store: PresidentStore;
  let load: jasmine.Spy;
  const result = () => parsePresidentEA20(presidentFixture(), '42', 1);
  beforeEach(() => {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
    load = jasmine.createSpy().and.resolveTo(result());
    TestBed.configureTestingModule({ providers: [{ provide: ELECTION_DATA_PROVIDER, useValue: { loadPresident: load } }] });
    store = TestBed.inject(PresidentStore);
  });
  it('preserves the previous data on failed manual refresh', async () => {
    await store.load(testConfiguration, testElection);
    load.and.rejectWith(new Error('HTTP 429'));
    await store.load(testConfiguration, testElection);
    expect(store.result()?.electionId).toBe('42');
    expect(store.error()).toBe('HTTP 429');
    expect(store.loading()).toBeFalse();
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
  });
});
