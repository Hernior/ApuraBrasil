import { parseFederalDeputyEA20, parsePresidentEA20 } from '../api/ea20-parser';
import { presidentFixture } from '../api/president-test.fixture';
import { deputyFixture } from '../api/federal-deputy-test.fixture';
import { ElectionResult } from '../models/election-result.model';
import { calculateDeputySeats } from './proportional-allocation';
import { electionDecisions } from './election-decisions';

function majority(votes: number[], remaining = 0): ElectionResult {
  const result = parsePresidentEA20(presidentFixture(), '42', 1);
  return { ...result, remainingElectors: remaining, validVotes: votes.reduce((a, b) => a + b, 0),
    candidates: votes.map((votes, index) => ({ ...result.candidates[0]!, id: `${index}`, votes, elected: false, status: null })) };
}

describe('Confirmed election decisions', () => {
  it('reads TSE mathematical signals without interpreting e=s alone as elected', () => {
    const data = { ...presidentFixture(), md: 's', tf: 'n', e: { ...presidentFixture().e, esnt: '10', esna: '2', esni: '1' } };
    data.carg[0]!.agr[0]!.par[0]!.cand.forEach(c => { c.e = 's'; c.st = ''; });
    const result = parsePresidentEA20(data, '42', 1);
    expect(result.remainingElectors).toBe(13);
    expect([...electionDecisions(result).values()].map(d => d.label)).toEqual(['2º TURNO', '2º TURNO']);
    result.mathematicallyDefined = 'e'; result.candidates[1]!.elected = false;
    expect([...electionDecisions(result).values()][0]!.label).toBe('ELEITO');
    result.mathematicallyDefined = 'n'; result.remainingElectors = null;
    expect(electionDecisions(result).size).toBe(0);
    expect(() => parsePresidentEA20({ ...data, md: 'bad' }, '42', 1)).toThrow();
    expect(parsePresidentEA20({ ...data, e: { ...data.e, te: '100', est: '1' } }, '42', 1).remainingElectors).toBeNull();
  });
  it('requires a strict majority against all remaining ballots and suppresses a tie', () => {
    expect(electionDecisions(majority([61, 39], 20)).get('0')?.label).toBe('ELEITO');
    expect(electionDecisions(majority([60, 40], 20)).size).toBe(0);
    const governor = { ...majority([61, 39], 20), officeCode: '3' as const, scopeCode: 'al' };
    expect(electionDecisions(governor).get('0')?.label).toBe('ELEITO');
    expect(electionDecisions({ ...majority([50, 50]), round: 2 }).size).toBe(0);
  });
  it('confirms both second-round places only when majority is impossible and their positions cannot change', () => {
    expect([...electionDecisions(majority([45, 40, 15], 5)).values()].map(d => d.label)).toEqual(['2º TURNO', '2º TURNO']);
    expect(electionDecisions(majority([45, 40, 15], 20)).size).toBe(0);
    expect(electionDecisions(majority([40, 30, 30])).has('1')).toBeFalse();
    expect(electionDecisions({ ...majority([45, 40, 15], 5), round: 2 }).size).toBe(0);
  });
  it('uses national President and statewide Governor decisions even when a municipality has a different leader', () => {
    const national = majority([61, 39], 20), local = majority([1, 99]);
    expect(electionDecisions({ ...local, scopeCode: 'al/00001' }).size).toBe(0);
    expect(electionDecisions({ ...local, scopeCode: 'al/00001', nationalResult: national }).has('0')).toBeTrue();
    const state = { ...national, officeCode: '3' as const, scopeCode: 'al' };
    expect(electionDecisions({ ...local, officeCode: '3', scopeCode: 'al/00001', stateResult: state }).has('0')).toBeTrue();
    expect(electionDecisions({ ...local, scopeCode: 'al', nationalResult: { ...national, electionId: 'wrong' } }).size).toBe(0);
  });
  it('guarantees the two Senate seats without confusing two ballots per elector with the per-candidate bound', () => {
    const result = { ...majority([120, 100, 80], 10), officeCode: '5' as const, scopeCode: 'al', seats: 2 };
    expect([...electionDecisions(result).keys()]).toEqual(['0', '1']);
    result.remainingElectors = 20;
    expect([...electionDecisions(result).keys()]).toEqual(['0']);
  });
  it('confirms guaranteed QP seats in all three deputy cargos and leaves uncertain averages provisional', () => {
    const result = parseFederalDeputyEA20(deputyFixture(), '43', 1, 'al'); result.remainingElectors = 3;
    for (const officeCode of ['6', '7', '8'] as const) {
      const value = { ...result, officeCode, scopeCode: officeCode === '8' ? 'df' : 'al' };
      expect([...electionDecisions(value).keys()]).toEqual(['100', '110']);
      const complete = { ...value, remainingElectors: 0 };
      expect(electionDecisions(complete).size).toBe(calculateDeputySeats(complete).winners.length);
    }
  });
  it('checks the guaranteed QP candidate against every distribution of three pending ballots', () => {
    const base = parseFederalDeputyEA20(deputyFixture(), '43', 1, 'al'); base.remainingElectors = 3;
    const confirmed = [...electionDecisions(base).keys()]; expect(confirmed).toEqual(['100', '110']);
    function visit(budget: number, bucket: number, values: number[]) {
      if (bucket < 7) { for (let n = 0; n <= budget; n++) visit(budget - n, bucket + 1, [...values, n]); return; }
      const definitions = [
        { votes: [150 + values[0]!, 100 + values[1]!], legend: 30 + values[4]! },
        { votes: [140 + values[2]!], legend: 30 + values[5]! }, { votes: [50 + values[3]!], legend: values[6]! }
      ];
      const allocation = calculateDeputySeats(parseFederalDeputyEA20(deputyFixture('al', 3, definitions), '43', 1, 'al'));
      expect(allocation.unavailableReason).toBeNull();
      for (const id of confirmed) expect(allocation.winners.some(w => w.candidateId === id)).toBeTrue();
    }
    visit(3, 0, []);
  });
  it('blocks custom confirmation for unknown bounds, withheld voting, judicial uncertainty or inconsistent vote totals', () => {
    const result = majority([80, 20], 0);
    for (const changed of [{ remainingElectors: null }, { disclosureAllowed: false }, { noWinners: true }, { validVotes: 110 }, { phase: 's' as const }]) {
      expect(electionDecisions({ ...result, ...changed }).size).toBe(0);
    }
    result.candidates[1]!.voteDestination = 'Anulado sub judice'; expect(electionDecisions(result).size).toBe(0);
  });
  it('distinguishes official elected and second-round chips from final deputy calculation', () => {
    const result = majority([60, 40]); result.candidates[0]!.status = '2º turno';
    expect(electionDecisions(result).get('0')?.source).toBe('TSE'); expect(electionDecisions(result).get('0')?.label).toBe('2º TURNO');
    const data = deputyFixture(); data.tf = 's'; data.and = 'f'; data.esae = 'n';
    const deputy = parseFederalDeputyEA20(data, '43', 1, 'al');
    expect(electionDecisions(deputy).size).toBe(3); expect(electionDecisions(deputy).get('100')?.source).toBe('ApuraBrasil');
  });
});
