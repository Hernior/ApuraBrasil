import { Candidate } from '../models/candidate.model';
import { ElectionResult } from '../models/election-result.model';

export function senatorProjection(result: ElectionResult | null): { candidateIds: string[]; notice: string | null } {
  const none = { candidateIds: [], notice: null };
  if (!result || result.officeCode !== '5' || !/^[a-z]{2}$/.test(result.scopeCode) || /^(br|zz)$/.test(result.scopeCode) ||
      result.seats !== 2 || !result.disclosureAllowed || result.progress !== 'p' || result.finalTotalization || result.noWinners) return none;
  const known = ['Válido', 'Válido (legenda)', 'Anulado', 'Anulado sub judice'];
  if (result.candidates.some(c => c.votes === null || !known.includes(c.voteDestination ?? ''))) return { ...none, notice: 'Destaque provisório aguardando a destinação dos votos de todos os candidatos da UF.' };
  const candidates = result.candidates.filter(c => c.voteDestination === 'Válido' && c.votes! > 0);
  const dates = (candidate: Candidate): string => {
    if (!candidate.birthDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(candidate.birthDate)) throw new Error('Destaque provisório aguardando dados de idade para desempatar a faixa de eleição da UF.');
    const iso = candidate.birthDate.split('/').reverse().join('-');
    const date = new Date(iso + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error('Data de nascimento inválida para desempatar a faixa de eleição.');
    return iso;
  };
  try {
    candidates.sort((a, b) => b.votes! - a.votes!);
    const selected: Candidate[] = [];
    for (let i = 0; i < candidates.length && selected.length < 2;) {
      const votes = candidates[i]!.votes;
      const tied: Candidate[] = [];
      while (i < candidates.length && candidates[i]!.votes === votes) tied.push(candidates[i++]!);
      const remaining = 2 - selected.length;
      if (tied.length > remaining) {
        const byAge = tied.map(candidate => ({ candidate, date: dates(candidate) })).sort((a, b) => a.date.localeCompare(b.date));
        if (byAge[remaining - 1]!.date === byAge[remaining]!.date) throw new Error('Empate de votos e idade na faixa de eleição: aguardando definição do TSE.');
        selected.push(...byAge.slice(0, remaining).map(entry => entry.candidate));
      } else selected.push(...tied);
    }
    return { candidateIds: selected.map(c => c.id), notice: null };
  } catch (error) { return { ...none, notice: error instanceof Error ? error.message : 'Destaque provisório indisponível.' }; }
}
