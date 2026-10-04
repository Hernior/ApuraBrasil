import { parseFederalDeputyEA20 } from '../api/ea20-parser';
import { deputyFixture } from '../api/federal-deputy-test.fixture';
import { calculateFederalDeputySeats } from './proportional-allocation';

describe('Federal deputy proportional allocation under the 2026 rules', () => {
  const calculate = (data = deputyFixture()) => parseFederalDeputyEA20(data, '43', 1, 'al').allocation!;
  it('allocates by QP and average using nominal and legend votes, preserving official status', () => {
    const result = parseFederalDeputyEA20(deputyFixture(), '43', 1, 'al');
    expect(result.allocation?.quotient).toBe(167);
    expect(result.allocation?.groups.map(g => g.seats)).toEqual([2, 1, 0]);
    expect(result.allocation?.winners).toEqual([{ candidateId: '100', method: 'qp' }, { candidateId: '110', method: 'qp' }, { candidateId: '101', method: 'average' }]);
    expect(result.allocation?.final).toBeFalse(); expect(result.candidates.every(c => c.status === null)).toBeTrue();
  });
  it('rounds exactly half down and greater fractions up', () => {
    expect(calculate(deputyFixture('al', 2, [{ votes: [201], legend: 0 }])).quotient).toBe(100);
    expect(calculate(deputyFixture('al', 3, [{ votes: [302], legend: 0 }])).quotient).toBe(101);
  });
  it('includes legend votes even when a party has no candidates', () => {
    const data = deputyFixture('al', 2, [{ votes: [90, 60], legend: 0 }, { votes: [], legend: 50 }]);
    expect(calculate(data).quotient).toBe(100); expect(calculate(data).winners.length).toBe(2);
  });
  it('does not fill QP seats with candidates below 10% and keeps unfilled QP in the average denominator', () => {
    const data = deputyFixture('al', 3, [{ votes: [5], legend: 195 }, { votes: [100, 10], legend: 20 }, { votes: [90, 10], legend: 20 }]);
    const allocation = calculate(data);
    expect(allocation.quotient).toBe(150);
    // A has QP=1 but no nominee >=15: its first average is 200/2, not 200/1.
    // Restricted round selects B (130) then C (120). Open round finally selects A.
    expect(allocation.winners.map(w => w.candidateId)).toEqual(['110', '120', '100']);
  });
  it('allows all groups and candidates in the final remainder phase below the 80/20 thresholds', () => {
    const allocation = calculate(deputyFixture('al', 2, [{ votes: [100], legend: 0 }, { votes: [75], legend: 0 }, { votes: [74], legend: 0 }]));
    expect(allocation.groups.map(g => g.seats)).toEqual([1, 1, 0]);
  });
  it('uses averages when no group reaches QE instead of the global candidate ranking', () => {
    const allocation = calculate(deputyFixture('al', 1, [{ votes: [60], legend: 130 }, { votes: [100], legend: 0 }]));
    expect(allocation.quotient).toBe(290); expect(allocation.winners[0]?.candidateId).toBe('100');
  });
  it('accepts candidates exactly on the 10% and 20% boundaries', () => {
    const allocation = calculate(deputyFixture('al', 3, [{ votes: [10, 20], legend: 170 }, { votes: [20], legend: 60 }, { votes: [20], legend: 0 }]));
    expect(allocation.quotient).toBe(100); expect(allocation.winners.map(w => w.candidateId)).toEqual(['101', '100', '110']);
  });
  it('combines parties in a federation as one electoral list', () => {
    const data = deputyFixture(); const groups = data.carg[0]!.agr;
    groups[0]!.tp = 'f'; groups[0]!.par.push(...groups[1]!.par); groups.splice(1, 1);
    const allocation = calculate(data);
    expect(allocation.groups[0]?.votes).toBe(450); expect(allocation.groups[0]?.seats).toBe(3);
  });
  it('uses age to decide equal nominal votes within the same group', () => {
    const allocation = calculate(deputyFixture('al', 1, [{ votes: [100, 100], legend: 0 }]));
    expect(allocation.winners[0]?.candidateId).toBe('100');
    const data = deputyFixture('al', 1, [{ votes: [100, 100], legend: 0 }]); data.carg[0]!.agr[0]!.par[0]!.cand[0]!.dt = '';
    expect(calculate(data).unavailableReason).toContain('nascimento');
  });
  it('does not invent a winner for equal votes and birth dates or an unresolved group tie', () => {
    const data = deputyFixture('al', 1, [{ votes: [100, 100], legend: 0 }]); data.carg[0]!.agr[0]!.par[0]!.cand[1]!.dt = '01/01/1960';
    expect(calculate(data).winners).toEqual([]);
    const tie = calculate(deputyFixture('al', 1, [{ votes: [100], legend: 0 }, { votes: [100], legend: 0 }]));
    expect(tie.unavailableReason).toContain('Empate');
  });
  it('does not block allocation because of ties among lower-ranked groups or candidates', () => {
    const groups = calculate(deputyFixture('al', 1, [{ votes: [100], legend: 0 }, { votes: [100], legend: 0 }, { votes: [200], legend: 0 }]));
    expect(groups.winners[0]?.candidateId).toBe('120');
    const data = deputyFixture('al', 1, [{ votes: [20, 20, 30], legend: 0 }]);
    data.carg[0]!.agr[0]!.par[0]!.cand[0]!.dt = '';
    expect(calculate(data).winners[0]?.candidateId).toBe('102');
  });
  it('uses total votes then nominal votes to break equal group averages', () => {
    const allocation = calculate(deputyFixture('al', 1, [{ votes: [90, 10], legend: 0 }, { votes: [80, 10], legend: 10 }]));
    expect(allocation.winners.map(w => w.candidateId)).toEqual(['100']);
  });
  it('excludes annulled and legend-only candidates from winners', () => {
    const data = deputyFixture(); const candidate = data.carg[0]!.agr[0]!.par[0]!.cand[0]!;
    candidate.dvt = 'Válido (legenda)';
    data.carg[0]!.agr[0]!.par[0]!.tvtn = '100'; data.carg[0]!.agr[0]!.par[0]!.tvtl = '180';
    const allocation = calculate(data);
    expect(allocation.winners.some(w => w.candidateId === '100')).toBeFalse(); expect(allocation.unavailableReason).toBeNull();
    candidate.dvt = 'Anulado sub judice';
    expect(calculate(data).winners.some(w => w.candidateId === '100')).toBeFalse();
  });
  it('blocks incomplete or inconsistent input and disclosure restrictions', () => {
    const data = deputyFixture(); data.carg[0]!.agr[0]!.par[0]!.dvt = '';
    expect(calculate(data).unavailableReason).toContain('Destinação');
    const inconsistent = deputyFixture(); inconsistent.v.vv = '501';
    expect(calculate(inconsistent).unavailableReason).toContain('não conferem');
    const hidden = deputyFixture(); hidden.dv = 'n';
    expect(calculate(hidden).winners).toEqual([]);
    const result = parseFederalDeputyEA20(deputyFixture('al/00001'), '43', 1, 'al/00001');
    expect(calculateFederalDeputySeats(result).unavailableReason).toContain('toda a UF');
  });
  it('only marks final after tf=s, final progress and confirmation that winners may be assigned', () => {
    const data = deputyFixture(); data.and = 'f';
    expect(calculate(data).final).toBeFalse(); data.tf = 's'; data.esae = 'n';
    expect(calculate(data).final).toBeTrue(); data.esae = 's';
    expect(calculate(data).unavailableReason).toContain('sem atribuição');
  });
});
