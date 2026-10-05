import { parsePresidentEA20 } from '../../core/api/ea20-parser';
import { presidentFixture } from '../../core/api/president-test.fixture';
import { createElectionSnapshot } from '../../core/models/election-snapshot.model';
import { buildEvolutionModel } from './evolution-model';
import { evolutionOptions } from './evolution-chart';

describe('Evolution series from local observations', () => {
  const snapshot = () => createElectionSnapshot(parsePresidentEA20(presidentFixture(), '42', 1));
  it('uses the latest ranking for Top 2, 3, 5 and All, keeping identity across previous ranks', () => {
    const first = snapshot();
    first.candidates = Array.from({ length: 6 }, (_, i) => ({ ...first.candidates[0]!, id: `${i}`, name: `Pessoa ${i}`, votes: i, percentage: i }));
    const second = { ...first, candidates: first.candidates.map(c => ({ ...c, votes: 10 - c.votes! })) };
    for (const [limit, length] of [['2', 2], ['3', 3], ['5', 5], ['all', 6]] as const) {
      const model = buildEvolutionModel([first, second], limit);
      expect(model.series.length).toBe(length); expect(model.series[0]!.id).toBe('0');
      expect(model.series[0]!.points.map(p => p.votes)).toEqual([0, 10]);
    }
  });
  it('preserves missing candidates, percentages and disclosure gaps as null, never zero', () => {
    const first = snapshot(); const candidate = first.candidates[0]!;
    const middle = { ...first, disclosureAllowed: false, candidates: [] };
    const last = { ...first, processedPercentage: null, candidates: [candidate] };
    const series = buildEvolutionModel([first, middle, last], '2').series[0]!;
    expect(series.points[1]!.percentage).toBeNull(); expect(series.points[1]!.votes).toBeNull();
    expect(series.points[2]!.processedPercentage).toBeNull(); expect(series.points[0]!.percentage).toBe(candidate.percentage);
    expect(buildEvolutionModel([first, middle], 'all').series).toEqual([]);
  });
  it('preserves corrections and distinct observations at the same totalization percentage', () => {
    const first = snapshot(); const second = { ...first, candidates: first.candidates.map(c => ({ ...c, percentage: 0 })) };
    const points = buildEvolutionModel([first, second], '2').series[0]!.points;
    expect(points.length).toBe(2); expect(points[0]!.processedPercentage).toBe(points[1]!.processedPercentage); expect(points[1]!.percentage).toBe(0);
  });
  it('creates numeric axes, separate tooltip metadata and no interpolation over gaps', () => {
    const options = evolutionOptions(buildEvolutionModel([snapshot()], '2'));
    expect(options.xAxis).toEqual(jasmine.objectContaining({ type: 'value', min: 0, max: 100 }));
    expect(options.yAxis).toEqual(jasmine.objectContaining({ type: 'value', min: 0, max: 100 }));
    expect(options.tooltip).toEqual(jasmine.objectContaining({ renderMode: 'richText' }));
    expect(options.series).toEqual(jasmine.arrayContaining([jasmine.objectContaining({ connectNulls: false, smooth: false,
      dimensions: ['Seções totalizadas (%)', 'Percentual TSE (%)', 'Votos', 'Arquivo TSE', 'Recebido neste navegador'] })]));
  });
});
