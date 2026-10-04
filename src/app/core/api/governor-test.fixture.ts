import { Election, ElectionConfiguration } from '../models/election.model';
import { presidentFixture, testConfiguration } from './president-test.fixture';

export const governorElection: Election = {
  id: '43', name: 'Eleição estadual de teste', type: 1, kind: 'state', round: 1,
  secondRoundId: null, contestId: '10', cycle: 'ele2026', date: '04/10/2026',
  scopes: [{ code: 'br', offices: [{ code: '3', name: 'Governador', type: 1 }] }]
};
export const governorConfiguration: ElectionConfiguration = {
  ...testConfiguration, elections: [...testConfiguration.elections, governorElection],
  directories: [...testConfiguration.directories, { type: 'cm', template: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/config' }]
};
export function governorFixture(scope = 'al') {
  const data = presidentFixture(); data.carg[0]!.cd = '3';
  return { ...data, ele: '43', tpabr: scope.includes('/') ? 'mu' : 'uf', cdabr: scope.split('/')[1] ?? scope };
}
export function governorCitiesFixture() {
  return { f: 'o', abr: [
    { cd: 'al', mu: [{ cd: '00001', cdi: '2700001', nm: 'Cidade teste', c: 's' }] },
    { cd: 'df', mu: [{ cd: '97012', cdi: '5300108', nm: 'Brasília', c: 's' }] }
  ] };
}
export function governorTrackingFixture() {
  return { ele: '43', t: '1', f: 'o', idg: '500', abr: [
    { tpabr: 'uf', cdabr: 'al', and: 'p', dt: '04/10/2026', ht: '16:59:00', s: { st: '50' }, e: {} },
    { tpabr: 'uf', cdabr: 'df', and: 'p', dt: '04/10/2026', ht: '16:59:00', s: { st: '50' }, e: {} }
  ] };
}
