import { governorFixture } from './governor-test.fixture';
import { senatorConfiguration, senatorElection } from './senator-test.fixture';

export const deputyElection = { ...senatorElection, scopes: [{ code: 'br', offices: [...senatorElection.scopes[0]!.offices, { code: '6', name: 'Deputado Federal', type: 2 }] }] };
export const deputyConfiguration = { ...senatorConfiguration, elections: senatorConfiguration.elections.map(e => e.id === deputyElection.id ? deputyElection : e) };
export function deputyFixture(scope = 'al', seats = 3, definitions = [
  { votes: [150, 100], legend: 30 }, { votes: [140], legend: 30 }, { votes: [50], legend: 0 }
]) {
  const data = governorFixture(scope);
  const total = definitions.reduce((n, g) => n + g.legend + g.votes.reduce((sum, v) => sum + v, 0), 0);
  return { ...data, tf: 'n', esae: '', v: { ...data.v, vv: String(total) }, carg: [{ cd: '6', nv: String(seats), qe: '', fed: [], agr: definitions.map((g, i) => ({
    n: String(i + 1), nm: `Partido ${i + 1}`, com: `P${i + 1}`, tp: 'i', vag: '', par: [{ n: String(i + 10), sg: `P${i + 1}`, nm: `Partido ${i + 1}`, nfed: '',
      dvt: 'Válido (legenda)', tvtn: String(g.votes.reduce((sum, v) => sum + v, 0)), tvtl: String(g.legend), cand: g.votes.map((votes, j) => ({
        sqcand: String(100 + i * 10 + j), n: `${i + 10}${j}0`, nm: `Candidato ${i + 1}-${j + 1}`, nmu: `Candidato ${i + 1}-${j + 1}`,
        dt: `01/01/${1960 + j}`, dvt: 'Válido', st: '', seq: String(i * 10 + j + 1), e: 'n', vap: String(votes), pvapn: String(total ? votes * 100 / total : 0)
      }))
    }]
  })) }] };
}
