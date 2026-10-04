// Fixtures restricted to spec imports. Never imported by the application.
import { Election, ElectionConfiguration } from '../models/election.model';
export const testElection: Election = {
  id: '42', name: 'Eleição de teste', type: 8, kind: 'federal', round: 1,
  secondRoundId: null, contestId: '10', cycle: 'ele2026', date: '04/10/2026',
  scopes: [{ code: 'br', offices: [{ code: '1', name: 'Presidente', type: 1 }] }]
};
export const testConfiguration: ElectionConfiguration = {
  generatedDate: '04/10/2026', generatedTime: '17:00:00', generationId: '1',
  phase: 'o', elections: [testElection],
  directories: [
    { type: 'ab', template: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>' },
    { type: 'u', template: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>' },
    { type: 'ft', template: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/fotos/<uf>' }
  ]
};
export function presidentFixture() {
  return {
    ele: '42', t: '1', f: 'o', tpabr: 'br', cdabr: 'br', dv: 's', and: 'p',
    idg: '123', dg: '04/10/2026', hg: '17:00:00', dt: '04/10/2026', ht: '16:59:00',
    s: { ts: '100', st: '50', pst: '50,00', pstn: '50' },
    e: { c: '80', pc: '80,00', a: '20', pa: '20,00' },
    v: { vv: '70', vb: '5', tvn: '5', vn: '3', vnt: '2' },
    carg: [{
      cd: '1', fed: [{ n: '100', sg: 'Federação teste' }],
      agr: [{ par: [{ sg: 'TESTE', nfed: '100', cand: [
        { sqcand: '901', n: '90', nm: 'Nome A', nmu: 'Teste A', seq: '2', e: 'n', st: '', dvt: 'Válido', vap: '30', pvap: '42,86', pvapn: '42,857142857' },
        { sqcand: '902', n: '91', nm: 'Nome B', nmu: 'Teste B', seq: '1', e: 's', st: '2º turno', dvt: 'Válido', vap: '40', pvap: '57,14', pvapn: '57,142857143' }
      ] }] }]
    }]
  };
}

export function trackingFixture() {
  return {
    ele: '42', t: '1', f: 'o', idg: '500', dg: '04/10/2026', hg: '17:00:00',
    abr: [
      { tpabr: 'br', cdabr: 'br', and: 'p', dt: '04/10/2026', ht: '16:59:00', s: { st: '50' }, e: { c: '80' } },
      { tpabr: 'uf', cdabr: 'al', and: 'p', dt: '04/10/2026', ht: '16:59:00', s: { st: '10' }, e: { c: '15' } }
    ]
  };
}
