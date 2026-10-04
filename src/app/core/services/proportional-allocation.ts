import { Candidate } from '../models/candidate.model';
import { ElectionResult } from '../models/election-result.model';
import { ProportionalAllocation } from '../models/proportional.model';

// Resolução TSE 23.677, arts. 8 a 12-A, texto compilado com alterações de 2026.
// Todos os cálculos usam votos válidos da UF. QP e sobras não usam o ranking global.
export function calculateFederalDeputySeats(result: ElectionResult): ProportionalAllocation {
  const final = result.finalTotalization === true && result.progress === 'f' && result.noWinners === false;
  const unavailable = (reason: string): ProportionalAllocation => ({ quotient: null, final: false, unavailableReason: reason, winners: [], groups: [], unfilledSeats: result.seats ?? 0 });
  if (result.officeCode !== '6' || !/^[a-z]{2}$/.test(result.scopeCode) || /^(br|zz)$/.test(result.scopeCode)) return unavailable('O cálculo de vagas exige o resultado de Deputado Federal de toda a UF.');
  if (!result.disclosureAllowed || result.progress === 'n') return unavailable('Cálculo aguardando divulgação da votação estadual.');
  if (result.noWinners === true) return unavailable('O TSE informou totalização sem atribuição de eleitos nesta UF.');
  if (result.finalTotalization && (result.progress !== 'f' || result.noWinners === null)) return unavailable('Cálculo aguardando confirmação da totalização final pelo TSE.');
  const seats = result.seats, total = result.validVotes, rawGroups = result.proportionalGroups;
  if (!seats || !Number.isSafeInteger(seats) || seats > 513 || !total || !rawGroups?.length) return unavailable('Vagas ou votos válidos estaduais ainda indisponíveis para o cálculo.');
  const whole = Math.floor(total / seats);
  const qe = whole + (2 * (total % seats) > seats ? 1 : 0); // fração exatamente 0,5 é desprezada
  if (!qe) return unavailable('Votos estaduais insuficientes para formar o quociente eleitoral.');
  try {
    const byId = new Map(result.candidates.map(c => [c.id, c]));
    const candidateIds = rawGroups.flatMap(g => g.candidateIds);
    if (new Set(candidateIds).size !== candidateIds.length || candidateIds.length !== byId.size) throw new Error('Agrupamento de candidatos incompleto ou duplicado.');
    const groups = rawGroups.map(g => {
      if (g.nominalVotes === null || g.legendVotes === null) throw new Error('Votos nominais ou de legenda indisponíveis.');
      const candidates = g.candidateIds.map(id => {
        const c = byId.get(id);
        if (!c || c.votes === null || !['Válido', 'Válido (legenda)', 'Anulado', 'Anulado sub judice'].includes(c.voteDestination ?? '') ||
            !['Válido (legenda)', 'Anulado', 'Anulado sub judice'].includes(c.partyVoteDestination ?? '')) throw new Error('Destinação de votos ou candidatura incompleta.');
        return c;
      }).filter(c => c.voteDestination === 'Válido' && c.partyVoteDestination === 'Válido (legenda)');
      const votes = g.nominalVotes + g.legendVotes;
      if (!Number.isSafeInteger(votes)) throw new Error('Votação fora dos limites do cálculo.');
      if (candidates.reduce((n, c) => n + c.votes!, 0) !== g.nominalVotes) throw new Error('Votos nominais não conferem com as candidaturas válidas do agrupamento.');
      return { ...g, votes, qp: Math.floor(votes / qe), awarded: 0, candidates };
    });
    if (groups.reduce((n, g) => n + g.votes, 0) !== total) throw new Error('Votos dos partidos e federações não conferem com os votos válidos da UF.');
    if (groups.reduce((n, g) => n + g.qp, 0) > seats) throw new Error('Votação insuficiente para distribuir as vagas com segurança.');
    const winners: ProportionalAllocation['winners'] = [];
    const selected = new Set<string>();
    function older(a: Candidate, b: Candidate): number {
      const date = (s: string | null | undefined): string => {
        if (!s || !/^\d{2}\/\d{2}\/\d{4}$/.test(s)) throw new Error('Data de nascimento ausente para desempatar candidatos.');
        const iso = s.split('/').reverse().join('-');
        const parsed = new Date(iso + 'T00:00:00Z');
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) throw new Error('Data de nascimento inválida para desempate.');
        return iso;
      };
      const comparison = date(a.birthDate).localeCompare(date(b.birthDate));
      if (!comparison) throw new Error('Empate de votos e idade exige definição oficial do TSE.');
      return comparison;
    }
    function next(group: typeof groups[number], minimum: number, resolveAge = true): Candidate | undefined {
      const eligible = group.candidates.filter(c => !selected.has(c.id) && BigInt(c.votes!) * 100n >= BigInt(qe) * BigInt(minimum));
      if (!eligible.length) return undefined;
      const maximum = eligible.reduce((n, c) => Math.max(n, c.votes!), 0);
      const tied = eligible.filter(c => c.votes === maximum);
      let best: Candidate | undefined;
      for (const c of tied) {
        if (!best || (resolveAge && older(c, best) < 0)) best = c;
      }
      return best;
    }
    function award(group: typeof groups[number], candidate: Candidate, method: 'qp' | 'average'): void {
      winners.push({ candidateId: candidate.id, method }); selected.add(candidate.id); group.awarded++;
    }
    for (const group of groups) {
      for (let i = 0; i < group.qp; i++) {
        const candidate = next(group, 10);
        if (!candidate) break;
        award(group, candidate, 'qp');
      }
    }
    const extra = new Map(groups.map(g => [g.id, 0]));
    for (const restricted of [true, false]) {
      while (winners.length < seats) {
        const available = groups.filter(g => !restricted || BigInt(g.votes) * 100n >= BigInt(qe) * 80n)
          .map(group => ({ group, candidate: next(group, restricted ? 20 : 0, false), divisor: group.qp + extra.get(group.id)! + 1 }))
          .filter((entry): entry is typeof entry & { candidate: Candidate } => !!entry.candidate);
        let best: typeof available[number] | undefined;
        let tied = false;
        for (const entry of available) {
          if (!best) { best = entry; continue; }
          const average = BigInt(entry.group.votes) * BigInt(best.divisor) - BigInt(best.group.votes) * BigInt(entry.divisor);
          const votes = entry.group.votes - best.group.votes;
          const nominal = entry.candidate.votes! - best.candidate.votes!;
          if (average === 0n && votes === 0 && nominal === 0) tied = true;
          if (average > 0n || (average === 0n && (votes > 0 || (votes === 0 && nominal > 0)))) { best = entry; tied = false; }
        }
        if (!best) break;
        if (tied) throw new Error('Empate entre agrupamentos exige definição oficial do TSE.');
        award(best.group, next(best.group, restricted ? 20 : 0)!, 'average');
        extra.set(best.group.id, extra.get(best.group.id)! + 1);
      }
    }
    return { quotient: qe, final, unavailableReason: null, winners,
      groups: groups.map(g => ({ id: g.id, name: g.name, votes: g.votes, quotient: g.qp, seats: g.awarded, officialSeats: g.officialSeats })), unfilledSeats: seats - winners.length };
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : 'Dados insuficientes para calcular vagas.');
  }
}
