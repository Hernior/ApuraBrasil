import { ElectionResult } from '../models/election-result.model';
import { calculateDeputySeats } from './proportional-allocation';

export interface CandidateDecision {
  label: 'ELEITO' | '2º TURNO';
  source: 'TSE' | 'ApuraBrasil';
  explanation: string;
}

export function decisionResult(result: ElectionResult | null): ElectionResult | null {
  if (!result) return null;
  const office = result.officeCode ?? '1';
  const authority = office === '1' ? result.scopeCode === 'br' ? result : result.nationalResult
    : result.scopeCode.includes('/') ? result.stateResult : result;
  if (!authority || (authority.officeCode ?? '1') !== office || authority.electionId !== result.electionId || authority.round !== result.round || authority.phase !== result.phase ||
      authority.scopeCode !== (office === '1' ? 'br' : result.scopeCode.split('/')[0])) return null;
  return authority;
}

// Proofs concern the current valid votes and candidate eligibility, not future judicial changes.
// Bound pending ballots by electors, never by a rounded percentage of processed sections.
export function electionDecisions(result: ElectionResult | null): Map<string, CandidateDecision> {
  const decisions = new Map<string, CandidateDecision>();
  const authority = decisionResult(result);
  if (!authority || authority.phase !== 'o' || !authority.disclosureAllowed || authority.noWinners === true) return decisions;
  const office = authority.officeCode ?? '1';
  const majority = office === '1' || office === '3';
  const proportional = ['6', '7', '8'].includes(office);
  const mark = (id: string, label: CandidateDecision['label'], source: CandidateDecision['source'], explanation: string) => decisions.set(id, { label, source, explanation });
  for (const candidate of authority.candidates) {
    if (/^eleit[oa](?:$|\s+por\s)/i.test(candidate.status?.trim() ?? '')) mark(candidate.id, 'ELEITO', 'TSE', 'Eleição informada pelo TSE.');
    else if (majority && authority.round === 1 && /^2[º°o]?\s*turno$/i.test(candidate.status?.trim() ?? '')) mark(candidate.id, '2º TURNO', 'TSE', 'Participação no segundo turno informada pelo TSE.');
    else if (!majority && authority.finalTotalization && authority.noWinners === false && candidate.elected) mark(candidate.id, 'ELEITO', 'TSE', 'Indicador de eleito publicado pelo TSE após a totalização final.');
  }
  if (majority && !authority.finalTotalization) {
    const flagged = authority.candidates.filter(candidate => candidate.elected);
    if (authority.mathematicallyDefined === 'e' && flagged.length === 1) mark(flagged[0]!.id, 'ELEITO', 'TSE', 'Eleição matematicamente definida pelo TSE (md=e).');
    if (authority.mathematicallyDefined === 's' && authority.round === 1 && flagged.length === 2) {
      for (const candidate of flagged) mark(candidate.id, '2º TURNO', 'TSE', 'Segundo turno matematicamente definido pelo TSE (md=s).');
    }
  }
  const allocation = proportional ? calculateDeputySeats(authority) : null;
  if (allocation?.final && !allocation.unavailableReason) {
    for (const winner of allocation.winners) if (!decisions.has(winner.candidateId)) mark(winner.candidateId, 'ELEITO', 'ApuraBrasil', 'Eleito pelo cálculo de vagas após a totalização final da UF.');
  }
  if (majority && decisions.size) return decisions;
  const remaining = authority.remainingElectors;
  if (remaining === undefined || remaining === null || !Number.isSafeInteger(remaining) || remaining < 0 || authority.progress === 'n' || !authority.validVotes ||
      authority.candidates.some(candidate => candidate.votes === null || !Number.isSafeInteger(candidate.votes) || candidate.votes < 0 || candidate.voteDestination !== 'Válido' ||
        (proportional && candidate.partyVoteDestination !== 'Válido (legenda)'))) return decisions;
  const candidates = authority.candidates;
  const canMark = (id: string) => !decisions.has(id) && !/^não eleito$/i.test(candidates.find(candidate => candidate.id === id)?.status?.trim() ?? '');
  const pending = BigInt(remaining);
  const total = BigInt(authority.validVotes);
  const explanation = `Confirmação matemática do ApuraBrasil com a votação e elegibilidade atuais e até ${remaining.toLocaleString('pt-BR')} eleitores pendentes. Sujeita a correções ou decisões judiciais do TSE.`;
  if (majority || office === '5') {
    if (candidates.reduce((sum, candidate) => sum + BigInt(candidate.votes!), 0n) !== total) return decisions;
    for (const candidate of candidates) {
      if (!canMark(candidate.id) || candidate.votes! <= 0) continue;
      const votes = BigInt(candidate.votes!);
      if (majority && 2n * votes > total + pending) mark(candidate.id, 'ELEITO', 'ApuraBrasil', explanation);
      else if (office === '5' && authority.seats === 2 && candidates.filter(other => other.id !== candidate.id && BigInt(other.votes!) + pending >= votes).length < 2) mark(candidate.id, 'ELEITO', 'ApuraBrasil', explanation);
    }
    // No candidate can reach a strict majority even if all remaining ballots go to them.
    const secondRoundCertain = majority && authority.round === 1 && candidates.every(candidate => 2n * BigInt(candidate.votes!) + pending <= total);
    if (secondRoundCertain) for (const candidate of candidates) {
      if (canMark(candidate.id) && candidate.votes! > 0 && candidates.filter(other => other.id !== candidate.id && BigInt(other.votes!) + pending >= BigInt(candidate.votes!)).length < 2) mark(candidate.id, '2º TURNO', 'ApuraBrasil', explanation);
    }
  } else if (proportional && allocation && !allocation.unavailableReason && authority.seats && authority.proportionalGroups) {
    if (remaining === 0) {
      for (const winner of allocation.winners) if (canMark(winner.candidateId)) mark(winner.candidateId, 'ELEITO', 'ApuraBrasil', explanation);
    } else {
      const seats = BigInt(authority.seats);
      const maximumTotal = total + pending;
      const maximumQuotient = maximumTotal / seats + (2n * (maximumTotal % seats) > seats ? 1n : 0n);
      if (!maximumQuotient) return decisions;
      // Guaranteed QP seats: use the largest possible QE and the group's current votes.
      // Counting each rival as if they individually received every remaining ballot is conservative.
      for (const group of authority.proportionalGroups) {
        const guaranteedSeats = BigInt(group.nominalVotes! + group.legendVotes!) / maximumQuotient;
        const members = candidates.filter(candidate => group.candidateIds.includes(candidate.id));
        for (const candidate of members) if (canMark(candidate.id) && candidate.votes! > 0 && BigInt(candidate.votes!) * 10n >= maximumQuotient &&
            BigInt(members.filter(other => other.id !== candidate.id && BigInt(other.votes!) + pending >= BigInt(candidate.votes!)).length) < guaranteedSeats) mark(candidate.id, 'ELEITO', 'ApuraBrasil', explanation);
      }
    }
  }
  return decisions;
}
