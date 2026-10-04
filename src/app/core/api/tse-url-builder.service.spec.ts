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
