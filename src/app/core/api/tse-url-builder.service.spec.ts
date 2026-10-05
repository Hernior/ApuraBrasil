import { testConfiguration, testElection } from './president-test.fixture';
import { TseUrlBuilderService } from './tse-url-builder.service';

describe('TseUrlBuilderService', () => {
  const builder = new TseUrlBuilderService();
  it('builds official EA11 without an election id', () => {
    expect(builder.configurationUrl()).toBe('https://resultados.tse.jus.br/oficial/comum/config/ele-c.json');
  });
  it('supports the documented simulation base and removes trailing slashes', () => {
    expect(builder.configurationUrl('https://resultados-sim.tse.jus.br/simulado/', 'simulado2026'))
      .toBe('https://resultados-sim.tse.jus.br/simulado/simulado2026/comum/config/ele-c.json');
  });
});

describe('President URLs from EA11', () => {
  const builder = new TseUrlBuilderService();
  it('uses the published directory and pads election only in the filename', () => {
    expect(builder.presidentUrl(testConfiguration, testElection))
      .toBe('https://resultados.tse.jus.br/oficial/ele2026/42/dados/br/br-c0001-e000042-u.json');
    expect(builder.candidatePhotoUrl(testConfiguration, testElection, '901'))
      .toBe('https://resultados.tse.jus.br/oficial/ele2026/42/fotos/br/901.jpeg');
  });
  it('does not guess missing result or photo directories', () => {
    const configuration = { ...testConfiguration, directories: [] };
    expect(() => builder.presidentUrl(configuration, testElection)).toThrow();
    expect(builder.candidatePhotoUrl(configuration, testElection, '901')).toBeNull();
  });
  it('rejects foreign origins, unresolved tokens and wrong elections', () => {
    const config = (template: string) => ({ ...testConfiguration, directories: [{ type: 'u', template }] });
    expect(() => builder.presidentUrl(config('https://example.com/result'), testElection)).toThrow();
    expect(() => builder.presidentUrl(config('<base>/<unknown>'), testElection)).toThrow();
    expect(() => builder.presidentUrl(testConfiguration, { ...testElection, kind: 'state' })).toThrow();
  });
});

describe('EA14 URL', () => {
  it('uses ab directory with a six-digit election filename', () => {
    expect(new TseUrlBuilderService().trackingUrl(testConfiguration, testElection))
      .toBe('https://resultados.tse.jus.br/oficial/ele2026/42/dados/br/br-e000042-ab.json');
  });
});
