import { TseParserService } from './tse-parser.service';

function fixture() {
  const election = (cd: string, tp: string, t = '1') => ({
    cd, tp, t, cdt2: '', nm: 'Eleição de teste',
    abr: [{ cd: 'br', cp: [{ cd: '1', ds: 'Cargo de teste', tp: '1' }] }]
  });
  return {
    dg: '04/10/2026', hg: '17:00:00', idg: '42', f: 'o',
    arq: [{ tp: 'u', dir: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>' }],
    pl: [
      { cd: '10', c: 'ele2024', dt: '06/10/2024', e: [election('20', '8')] },
      { cd: '11', c: 'ele2026', dt: '04/10/2026', e: [election('21', '8'), election('22', '1'), election('23', '3'), election('24', '2')] }
    ]
  };
}

describe('TseParserService EA11 (layout 23/06/2026)', () => {
  const parser = new TseParserService();
  it('discovers only ordinary federal and state elections in cycle 2026', () => {
    const result = parser.parseEA11(fixture());
    expect(result.elections.map(e => e.id)).toEqual(['21', '22']);
    expect(result.elections.map(e => e.kind)).toEqual(['federal', 'state']);
    expect(result.elections[0]?.scopes[0]?.offices[0]?.name).toBe('Cargo de teste');
    expect(result.generationId).toBe('42');
  });
  it('keeps second-round references without inventing available elections', () => {
    const data = fixture();
    data.pl[1]!.e[0]!.cdt2 = '90';
    const result = parser.parseEA11(data);
    expect(result.elections[0]?.secondRoundId).toBe('90');
    expect(result.elections.some(e => e.id === '90')).toBeFalse();
  });
  it('preserves real second-round entries and state scopes', () => {
    const data = fixture();
    data.pl[1]!.e[1]!.t = '2';
    data.pl[1]!.e[1]!.abr[0]!.cd = 'AL';
    const result = parser.parseEA11(data);
    expect(result.elections[1]?.round).toBe(2);
    expect(result.elections[1]?.scopes[0]?.code).toBe('al');
  });
  it('accepts no available general elections', () => {
    const data = fixture(); data.pl = [];
    expect(parser.parseEA11(data).elections).toEqual([]);
  });
  it('rejects missing arrays, invalid phases, turns and duplicate ids', () => {
    expect(() => parser.parseEA11({ ...fixture(), pl: null })).toThrow();
    expect(() => parser.parseEA11({ ...fixture(), f: 'x' })).toThrow();
    const data = fixture(); data.pl[1]!.e[0]!.t = '3';
    expect(() => parser.parseEA11(data)).toThrow();
    const duplicate = fixture(); duplicate.pl[1]!.e[1]!.cd = '21';
    expect(() => parser.parseEA11(duplicate)).toThrow();
  });
});
