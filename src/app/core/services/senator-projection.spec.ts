import { parseSenatorEA20 } from '../api/ea20-parser';
import { senatorFixture } from '../api/senator-test.fixture';
import { senatorProjection } from './senator-projection';

describe('Provisional senator projection from valid statewide votes', () => {
  function result() { return parseSenatorEA20(senatorFixture(), '43', 1, 'al'); }
  it('highlights two statewide valid candidates, excluding annulled votes and zero votes', () => {
    const data = result();
    data.candidates.push({ ...data.candidates[0]!, id: '999', votes: 1000, voteDestination: 'Anulado sub judice' });
    expect(senatorProjection(data).candidateIds).toEqual(data.candidates.slice(0, 2).map(c => c.id));
    data.candidates[1]!.votes = 0;
    expect(senatorProjection(data).candidateIds.length).toBe(1);
  });
  it('does not infer elected after finalization or for hidden, national or municipal results', () => {
    const data = result(); data.progress = 'f';
    expect(senatorProjection(data).candidateIds).toEqual([]);
    data.progress = 'p'; data.finalTotalization = true;
    expect(senatorProjection(data).candidateIds).toEqual([]);
    data.finalTotalization = false; data.noWinners = true;
    expect(senatorProjection(data).candidateIds).toEqual([]);
    data.noWinners = null; data.disclosureAllowed = false;
    expect(senatorProjection(data).candidateIds).toEqual([]);
    expect(senatorProjection(parseSenatorEA20(senatorFixture('al/00001'), '43', 1, 'al/00001')).candidateIds).toEqual([]);
  });
  it('uses age only to decide a tie that crosses the two-seat boundary, never fixture sequence', () => {
    const data = result(); data.candidates[1]!.birthDate = '01/01/1990';
    data.candidates.push({ ...data.candidates[1]!, id: '999', birthDate: '01/01/1960' });
    expect(senatorProjection(data).candidateIds).toEqual([data.candidates[0]!.id, '999']);
    data.candidates[2]!.birthDate = '01/01/1990';
    expect(senatorProjection(data).notice).toContain('Empate');
    expect(senatorProjection(data).candidateIds).toEqual([]);
  });
  it('waits for missing destination or tie-breaking date instead of highlighting an arbitrary candidate', () => {
    const data = result(); data.candidates[1]!.voteDestination = null;
    expect(senatorProjection(data).notice).toContain('destinação');
    data.candidates[1]!.voteDestination = 'Válido'; data.candidates.push({ ...data.candidates[1]!, id: '999' });
    expect(senatorProjection(data).notice).toContain('idade');
  });
});
