import { parsePresidentEA20, rankCandidates } from './ea20-parser';
import { presidentFixture } from './president-test.fixture';

describe('EA20 President layout 10/07/2026', () => {
  it('parses nested candidates, federation, comma decimals and total null votes', () => {
    const result = parsePresidentEA20(presidentFixture(), '42', 1);
    expect(result.candidates.map(c => c.id)).toEqual(['902', '901']);
    expect(result.candidates[0]?.percentage).toBeCloseTo(57.142857143, 9);
    expect(result.candidates[0]?.federation).toBe('Federação teste');
    expect(result.nullVotes).toBe(5);
    expect(result.processedPercentage).toBe(50);
  });
  it('preserves the official status rather than interpreting e=s as elected', () => {
    const result = parsePresidentEA20(presidentFixture(), '42', 1);
    expect(result.candidates[0]?.status).toBe('2º turno');
    expect(result.candidates[1]?.status).toBeNull();
  });
  it('does not expose candidate votes when dv=n', () => {
    const data = presidentFixture(); data.dv = 'n';
    const result = parsePresidentEA20(data, '42', 1);
    expect(result.disclosureAllowed).toBeFalse();
    expect(result.candidates.every(c => c.votes === null && c.percentage === null)).toBeTrue();
    expect(result.validVotes).toBeNull();
  });
  it('preserves unavailable values as null and real zeros as zero', () => {
    const data = presidentFixture(); data.carg[0]!.agr[0]!.par[0]!.cand[0]!.vap = '';
    data.carg[0]!.agr[0]!.par[0]!.cand[1]!.vap = '0';
    const result = parsePresidentEA20(data, '42', 1);
    expect(result.candidates[0]?.votes).toBe(0);
    expect(result.candidates[1]?.votes).toBeNull();
  });
  it('rejects a different election, round, scope or office', () => {
    expect(() => parsePresidentEA20(presidentFixture(), '43', 1)).toThrow();
    expect(() => parsePresidentEA20(presidentFixture(), '42', 2)).toThrow();
    expect(() => parsePresidentEA20({ ...presidentFixture(), tpabr: 'uf' }, '42', 1)).toThrow();
    const data = presidentFixture(); data.carg[0]!.cd = '3';
    expect(() => parsePresidentEA20(data, '42', 1)).toThrow();
  });
  it('rejects invalid percentages, missing structure and duplicate candidates', () => {
    const data = presidentFixture();
    data.carg[0]!.agr[0]!.par[0]!.cand[0]!.pvapn = '101';
    expect(() => parsePresidentEA20(data, '42', 1)).toThrow();
    expect(() => parsePresidentEA20({ ...presidentFixture(), s: null }, '42', 1)).toThrow();
    const dup = presidentFixture();
    dup.carg[0]!.agr[0]!.par[0]!.cand[0]!.sqcand = '902';
    expect(() => parsePresidentEA20(dup, '42', 1)).toThrow();
  });
  it('breaks vote ties using the official sequence without changing the input', () => {
    const result = parsePresidentEA20(presidentFixture(), '42', 1);
    const candidates = result.candidates.map(c => ({ ...c, votes: 10 }));
    candidates.reverse();
    expect(rankCandidates(candidates)[0]?.sequence).toBe(1);
    expect(candidates[0]?.sequence).toBe(2);
  });
});
