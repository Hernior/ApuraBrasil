import { governorConfiguration, governorElection, governorFixture } from './governor-test.fixture';
export const senatorElection = { ...governorElection, scopes: [{ code: 'br', offices: [...governorElection.scopes[0]!.offices, { code: '5', name: 'Senador', type: 1 }] }] };
export const senatorConfiguration = { ...governorConfiguration, elections: governorConfiguration.elections.map(e => e.id === senatorElection.id ? senatorElection : e) };
export function senatorFixture(scope = 'al') {
  const data = governorFixture(scope);
  const candidates = data.carg[0]!.agr[0]!.par[0]!.cand.map((c, i) => ({ ...c, st: '', vap: i ? '80' : '120', pvap: i ? '40,00' : '60,00', pvapn: i ? '40' : '60', vs: [
    { tp: 's1', nm: 'Suplente A', nmu: 'Primeiro suplente', sgp: 'TESTE' },
    { tp: 's2', nm: 'Suplente B', nmu: 'Segundo suplente', sgp: 'TESTE' }
  ] }));
  return { ...data, v: { ...data.v, vv: '200' }, e: { ...data.e, c: '100' }, carg: [{ ...data.carg[0]!, cd: '5', nv: '2', agr: [{ par: [{ ...data.carg[0]!.agr[0]!.par[0]!, cand: candidates }] }] }] };
}
