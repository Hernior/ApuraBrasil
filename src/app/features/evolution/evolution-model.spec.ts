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
    expect(options.xAxis).toEqual(jasmine.objectContaining({ type: 'value', min: 49.9, max: 50.1 }));
    expect(options.yAxis).toEqual(jasmine.objectContaining({ type: 'value', min: 0, max: 100 }));
    expect(options.tooltip).toEqual(jasmine.objectContaining({ renderMode: 'richText' }));
    expect(options.series).toEqual(jasmine.arrayContaining([jasmine.objectContaining({ connectNulls: false, smooth: false,
      dimensions: ['Seções totalizadas (%)', 'Percentual TSE (%)', 'Votos', 'Arquivo TSE', 'Recebido neste navegador'] })]));
  });
  it('uses votes on an uncapped integer axis while preserving raw values, missing data and corrections', () => {
    const first = snapshot();
    first.candidates = [{ ...first.candidates[0]!, votes: 1500000, percentage: null }];
    const second = { ...first, candidates: [{ ...first.candidates[0]!, votes: 1400000 }] };
    const missing = { ...first, candidates: [{ ...first.candidates[0]!, votes: null }] };
    const zero = { ...first, candidates: [{ ...first.candidates[0]!, votes: 0 }] };
    const model = buildEvolutionModel([first, second, missing, zero], '2');
    const options = evolutionOptions(model, 'votes');
    expect(options.yAxis).toEqual(jasmine.objectContaining({ type: 'value', min: 0, minInterval: 1, name: 'Votos acumulados' }));
    expect(options.yAxis).not.toEqual(jasmine.objectContaining({ max: 100 }));
    expect(options.series).toEqual(jasmine.arrayContaining([jasmine.objectContaining({ encode: { x: 0, y: 2, tooltip: [3, 4, 0, 2, 1] },
      data: [
        [50, '-', 1500000, model.series[0]!.points[0]!.generatedAt, model.series[0]!.points[0]!.observedAt],
        [50, '-', 1400000, model.series[0]!.points[1]!.generatedAt, model.series[0]!.points[1]!.observedAt],
        [50, '-', '-', model.series[0]!.points[2]!.generatedAt, model.series[0]!.points[2]!.observedAt],
        [50, '-', 0, model.series[0]!.points[3]!.generatedAt, model.series[0]!.points[3]!.observedAt]
      ] })]));
    expect(evolutionOptions(model, 'percentage').series).toEqual(jasmine.arrayContaining([jasmine.objectContaining({ encode: { x: 0, y: 1, tooltip: [3, 4, 0, 2, 1] } })]));
  });
  it('fits both horizontal axes to the observed interval, including corrections and missing percentages', () => {
    const first = snapshot();
    const model = buildEvolutionModel([98, 99, null, 98.5].map(processedPercentage => ({ ...first, processedPercentage })), '2');
    for (const metric of ['percentage', 'votes'] as const) {
      expect(evolutionOptions(model, metric).xAxis).toEqual(jasmine.objectContaining({ min: 97.9, max: 99.1 }));
    }
    expect(model.series[0]!.points.map(point => point.processedPercentage)).toEqual([98, 99, null, 98.5]);
  });
  it('keeps a usable horizontal range for one percentage, clamps to 0–100 and falls back for no observations', () => {
    const first = snapshot();
    for (const [percentages, min, max] of [
      [[100, 100], 99.9, 100], [[0], 0, .1], [[0, 100], 0, 100], [[null], 0, 100]
    ] as const) {
      const model = buildEvolutionModel(percentages.map(processedPercentage => ({ ...first, processedPercentage })), '2');
      expect(evolutionOptions(model).xAxis).toEqual(jasmine.objectContaining({ min, max }));
    }
    expect(evolutionOptions(buildEvolutionModel([], '2')).xAxis).toEqual(jasmine.objectContaining({ min: 0, max: 100 }));
  });
});
