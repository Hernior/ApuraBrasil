import { deputyConfiguration, deputyElection, deputyFixture } from './federal-deputy-test.fixture';

export const stateDeputyElection = { ...deputyElection, scopes: [{ code: 'br', offices: [...deputyElection.scopes[0]!.offices,
  { code: '7', name: 'Deputado Estadual', type: 2 }, { code: '8', name: 'Deputado Distrital', type: 2 }
] }] };
export const stateDeputyConfiguration = { ...deputyConfiguration, elections: deputyConfiguration.elections.map(e => e.id === stateDeputyElection.id ? stateDeputyElection : e) };
export function stateDeputyFixture(scope = 'al', seats = 3, definitions?: Parameters<typeof deputyFixture>[2]) {
  const result = deputyFixture(scope, seats, definitions);
  result.carg[0]!.cd = scope.split('/')[0] === 'df' ? '8' : '7';
  return result;
}
