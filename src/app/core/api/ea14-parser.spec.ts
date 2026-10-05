import { parseEA14 } from './ea14-parser';
import { trackingFixture } from './president-test.fixture';

describe('EA14 layout 10/06/2026', () => {
  it('reads national totalization independently from root generation id', () => {
    const result = parseEA14(trackingFixture(), '42', 1);
    expect(result.national.processedSections).toBe(50);
    expect(result.national.time).toBe('16:59:00');
  });
  it('ignores idg-only changes and order while detecting totalization changes', () => {
    const data = trackingFixture();
    const first = parseEA14(data, '42', 1);
    data.idg = '501'; data.abr.reverse();
    expect(parseEA14(data, '42', 1).signature).toBe(first.signature);
    data.abr[0]!.ht = '17:00:00';
    expect(parseEA14(data, '42', 1).signature).not.toBe(first.signature);
  });
  it('detects corrections to indicators even at the same time and section count', () => {
    const data = trackingFixture(); const first = parseEA14(data, '42', 1);
    data.abr[0]!.e.c = '81';
    expect(parseEA14(data, '42', 1).signature).not.toBe(first.signature);
  });
  it('rejects mismatched election, round, phase, missing Brasil and duplicates', () => {
    expect(() => parseEA14(trackingFixture(), '43', 1)).toThrow();
    expect(() => parseEA14(trackingFixture(), '42', 2)).toThrow();
    expect(() => parseEA14({ ...trackingFixture(), f: 'x' }, '42', 1)).toThrow();
    const data = trackingFixture(); data.abr.shift();
    expect(() => parseEA14(data, '42', 1)).toThrow();
    const dup = trackingFixture(); dup.abr.push(dup.abr[0]!);
    expect(() => parseEA14(dup, '42', 1)).toThrow();
  });
});
