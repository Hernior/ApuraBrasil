import { TestBed } from '@angular/core/testing';
import { parsePresidentEA20 } from '../api/ea20-parser';
import { presidentFixture } from '../api/president-test.fixture';
import { ElectionHistoryContext, createElectionSnapshot } from '../models/election-snapshot.model';
import { ElectionResult } from '../models/election-result.model';
import { ElectionHistoryService, HISTORY_DATABASE_NAME } from './election-history.service';

describe('Election history in IndexedDB', () => {
  let history: ElectionHistoryService;
  let databaseName: string;
  const result = () => parsePresidentEA20(presidentFixture(), '42', 1, 'br');
  beforeEach(() => {
    databaseName = `apurabrasil-spec-${crypto.randomUUID()}`;
    TestBed.configureTestingModule({ providers: [{ provide: HISTORY_DATABASE_NAME, useValue: databaseName }] });
    history = TestBed.inject(ElectionHistoryService);
  });
  afterEach(async () => {
    TestBed.resetTestingModule();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
  });
  it('persists across service recreation and captures values before asynchronous writes', async () => {
    const value = result(); const originalVotes = value.candidates[0]!.votes;
    const writing = history.record(value); value.candidates[0]!.votes = 999; await writing;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: HISTORY_DATABASE_NAME, useValue: databaseName }] });
    history = TestBed.inject(ElectionHistoryService);
    const snapshots = await history.read(createElectionSnapshot(result()));
    expect(snapshots.length).toBe(1); expect(snapshots[0]!.candidates.find(c => c.id === value.candidates[0]!.id)!.votes).toBe(originalVotes);
  });
  it('deduplicates identical simultaneous records and generation-only changes', async () => {
    const value = result();
    await Promise.all([history.record(value), history.record(value), history.record({ ...value, generationId: 'another', generatedTime: '18:00:00', candidates: [...value.candidates].reverse() })]);
    expect((await history.read(createElectionSnapshot(value))).length).toBe(1);
  });
  it('retains vote corrections, same-progress changes and reversions in observation order', async () => {
    const value = result();
    await history.record(value);
    await history.record({ ...value, candidates: value.candidates.map(c => ({ ...c, votes: 0, percentage: 0 })) });
    await history.record(value);
    const snapshots = await history.read(createElectionSnapshot(value));
    expect(snapshots.length).toBe(3); expect(snapshots[1]!.candidates[0]!.votes).toBe(0);
    expect(snapshots[2]!.candidates[0]!.votes).toBe(snapshots[0]!.candidates[0]!.votes);
  });
  it('isolates elections, offices, rounds, UFs, municipalities and simulated data', async () => {
    const base = result();
    const values: ElectionResult[] = [base, { ...base, electionId: '43' }, { ...base, officeCode: '3' }, { ...base, officeCode: '5' },
      { ...base, officeCode: '6' }, { ...base, officeCode: '7' }, { ...base, officeCode: '8' }, { ...base, round: 2 },
      { ...base, scopeCode: 'al' }, { ...base, scopeCode: 'al/00001' }, { ...base, phase: 's' }];
    for (const value of values) await history.record(value);
    for (const value of values) expect((await history.read(createElectionSnapshot(value))).length).toBe(1);
    expect(await history.read({ ...createElectionSnapshot(base), scopeCode: 'df' })).toEqual([]);
  });
  it('stores no hidden candidate voting before disclosure and omits nested UF data', async () => {
    const value = { ...result(), disclosureAllowed: false, stateResult: result() };
    await history.record(value);
    const snapshot = (await history.read(createElectionSnapshot(value)))[0]!;
    expect(snapshot.candidates).toEqual([]); expect(snapshot.validVotes).toBeNull(); expect(snapshot.turnout).toBeNull();
    expect('stateResult' in snapshot).toBeFalse(); expect(snapshot.processedPercentage).toBe(50);
  });
  it('reports storage failure without rejecting an accepted election result', async () => {
    spyOn(indexedDB, 'open').and.throwError('Storage unavailable');
    await history.record(result());
    expect(history.error()).toContain('Não foi possível salvar');
    const context: ElectionHistoryContext = createElectionSnapshot(result());
    expect(await history.read(context)).toEqual([]); expect(history.error()).toContain('indisponível');
  });
  it('notifies the active view even when another service already saved the same observation', async () => {
    await history.record(result());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: HISTORY_DATABASE_NAME, useValue: databaseName }] });
    history = TestBed.inject(ElectionHistoryService);
    await history.record(result());
    expect(history.revision()).toBe(1); expect((await history.read(createElectionSnapshot(result()))).length).toBe(1);
  });
});
