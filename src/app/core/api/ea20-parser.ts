import { Candidate } from '../models/candidate.model';
import { ElectionResult } from '../models/election-result.model';
import { ProportionalGroup } from '../models/proportional.model';
import { calculateDeputySeats } from '../services/proportional-allocation';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('EA20 inválido: objeto esperado.');
  return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('EA20 inválido: lista esperada.');
  return value;
}
function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('EA20 inválido: texto esperado.');
  return value;
}
function id(value: unknown): string {
  const s = typeof value === 'number' ? String(value) : string(value);
  if (!/^\d+$/.test(s)) throw new Error('EA20 inválido: código esperado.');
  return s.replace(/^0+(?=\d)/, '');
}
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return string(value);
}
function numeric(value: unknown, percentage = false): number | null {
  if (value === undefined || value === null || value === '') return null;
  const raw = typeof value === 'number' ? String(value) : string(value);
  if (!(percentage ? /^\d+(?:[,.]\d+)?$/ : /^\d+$/).test(raw)) throw new Error('EA20 inválido: valor numérico.');
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || (percentage ? n > 100 : !Number.isSafeInteger(n))) throw new Error('EA20 inválido: valor fora dos limites.');
  return n;
}

export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) =>
    (b.votes ?? -1) - (a.votes ?? -1) || a.sequence - b.sequence || a.id.localeCompare(b.id));
}

function parseSubstitutes(value: unknown): NonNullable<Candidate['substitutes']> {
  const substitutes = array(value ?? []).map(object).map((substitute): NonNullable<Candidate['substitutes']>[number] => {
    const type = string(substitute['tp']);
    if (type !== 's1' && type !== 's2') throw new Error('EA20 de Senador: tipo de suplente inválido.');
    return { type, name: optionalText(substitute['nmu']) ?? string(substitute['nm']), party: string(substitute['sgp']) };
  });
  if (new Set(substitutes.map(s => s.type)).size !== substitutes.length) throw new Error('EA20 de Senador: suplentes duplicados.');
  return substitutes.sort((a, b) => a.type.localeCompare(b.type));
}

export function parsePresidentEA20(input: unknown, electionId: string, round: 1 | 2, scope = 'br'): ElectionResult {
  return parseMajorityEA20(input, electionId, round, scope, '1');
}

export function parseGovernorEA20(input: unknown, electionId: string, round: 1 | 2, scope: string): ElectionResult {
  if (!/^[a-z]{2}(?:\/[0-9]{5})?$/.test(scope) || scope.startsWith('br') || scope.startsWith('zz')) throw new Error('Abrangência de Governador inválida.');
  return parseMajorityEA20(input, electionId, round, scope, '3');
}

export function parseSenatorEA20(input: unknown, electionId: string, round: 1 | 2, scope: string): ElectionResult {
  if (round !== 1 || !/^[a-z]{2}(?:\/[0-9]{5})?$/.test(scope) || scope.startsWith('br') || scope.startsWith('zz')) throw new Error('Turno ou abrangência de Senador inválido.');
  const result = parseMajorityEA20(input, electionId, round, scope, '5');
  if (result.seats !== 2) throw new Error('EA20 de Senador não informa as duas vagas de 2026.');
  return result;
}

export function parseFederalDeputyEA20(input: unknown, electionId: string, round: 1 | 2, scope: string): ElectionResult {
  if (round !== 1 || !/^[a-z]{2}(?:\/[0-9]{5})?$/.test(scope) || /^(br|zz)(\/|$)/.test(scope)) throw new Error('Turno ou abrangência de Deputado Federal inválido.');
  const result = parseMajorityEA20(input, electionId, round, scope, '6');
  if (!scope.includes('/')) result.allocation = calculateDeputySeats(result);
  return result;
}

export function parseStateDeputyEA20(input: unknown, electionId: string, round: 1 | 2, scope: string): ElectionResult {
  if (round !== 1 || !/^[a-z]{2}(?:\/[0-9]{5})?$/.test(scope) || /^(br|zz)(\/|$)/.test(scope)) throw new Error('Turno ou abrangência de Deputado Estadual/Distrital inválido.');
  const result = parseMajorityEA20(input, electionId, round, scope, scope.split('/')[0] === 'df' ? '8' : '7');
  if (!scope.includes('/')) result.allocation = calculateDeputySeats(result);
  return result;
}

function parseMajorityEA20(input: unknown, electionId: string, round: 1 | 2, scope: string, officeCode: '1' | '3' | '5' | '6' | '7' | '8'): ElectionResult {
  const proportional = ['6', '7', '8'].includes(officeCode);
  const root = object(input);
  const phase = string(root['f']);
  const progress = string(root['and']);
  const dv = string(root['dv']);
  if (id(root['ele']) !== id(electionId) || Number(root['t']) !== round ||
      root['tpabr'] !== (scope.includes('/') ? 'mu' : scope === 'br' ? 'br' : 'uf') || String(root['cdabr']).toLowerCase() !== (scope.split('/')[1] ?? scope)) {
    throw new Error('EA20 não corresponde à eleição ou à abrangência solicitada.');
  }
  if ((phase !== 'o' && phase !== 's') || !['n', 'p', 'f'].includes(progress) || !['s', 'n'].includes(dv)) {
    throw new Error('EA20 inválido: fase, andamento ou divulgação.');
  }
  const offices = array(root['carg']).map(object);
  const office = offices.find(c => id(c['cd']) === officeCode);
  if (!office || offices.length !== 1) throw new Error(`EA20 não corresponde ao cargo ${officeCode === '1' ? 'Presidente' : officeCode === '3' ? 'Governador' : officeCode === '5' ? 'Senador' : officeCode === '6' ? 'Deputado Federal' : officeCode === '7' ? 'Deputado Estadual' : 'Deputado Distrital'}.`);
  const federations = new Map<string, string>();
  for (const item of array(office['fed'] ?? [])) {
    const federation = object(item);
    federations.set(id(federation['n']), string(federation['sg']));
  }
  const candidates: Candidate[] = [];
  const proportionalGroups: ProportionalGroup[] = [];
  for (const item of array(office['agr'])) {
    const group = object(item);
    const parties = array(group['par'] ?? []).map(object);
    const groupCandidateIds: string[] = [];
    for (const party of parties) {
      for (const item of array(party['cand'] ?? [])) {
        const candidate = object(item);
        groupCandidateIds.push(id(candidate['sqcand']));
        candidates.push({
          id: id(candidate['sqcand']), number: id(candidate['n']),
          name: optionalText(candidate['nmu']) ?? string(candidate['nm']),
          party: string(party['sg']),
          federation: party['nfed'] ? federations.get(id(party['nfed'])) ?? null : null,
          status: optionalText(candidate['st']),
          voteDestination: optionalText(candidate['dvt']),
          votes: dv === 's' ? numeric(candidate['vap']) : null,
          percentage: dv === 's' ? numeric(candidate['pvapn'] ?? candidate['pvap'], true) : null,
          sequence: numeric(candidate['seq']) ?? Number.MAX_SAFE_INTEGER,
          photoUrl: null,
          ...(proportional ? { birthDate: optionalText(candidate['dt']), partyVoteDestination: optionalText(party['dvt']) } : {}),
          ...(officeCode === '5' ? { substitutes: parseSubstitutes(candidate['vs']), birthDate: optionalText(candidate['dt']) } : {})
        });
      }
    }
    if (proportional) {
      const type = string(group['tp']);
      if (type !== 'i' && type !== 'f') throw new Error('EA20 proporcional: agrupamento inválido.');
      const sum = (field: string): number | null => {
        const values = parties.map(p => numeric(p[field]));
        if (values.some(v => v === null)) return null;
        const total = values.reduce<number>((n, v) => n + v!, 0);
        if (!Number.isSafeInteger(total)) throw new Error('EA20 proporcional: votação fora dos limites.');
        return total;
      };
      proportionalGroups.push({ id: id(group['n']), name: optionalText(group['com']) ?? string(group['nm']), type,
        nominalVotes: dv === 's' ? sum('tvtn') : null, legendVotes: dv === 's' ? sum('tvtl') : null,
        officialSeats: dv === 's' ? numeric(group['vag']) : null, candidateIds: groupCandidateIds });
    }
  }
  if (new Set(proportionalGroups.map(g => g.id)).size !== proportionalGroups.length) throw new Error('EA20 proporcional: agrupamentos duplicados.');
  if (new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('EA20 inválido: candidatos duplicados.');
  const sections = object(root['s']);
  const electors = object(root['e']);
  const votes = object(root['v']);
  return {
    electionId: id(root['ele']), officeCode, seats: numeric(office['nv']), scopeCode: scope, round, phase, generationId: id(root['idg']),
    ...(proportional ? { proportionalGroups, officialQuotient: dv === 's' ? numeric(office['qe']) : null } : {}),
    ...(proportional || officeCode === '5' ? { finalTotalization: root['tf'] === 's', noWinners: root['esae'] === 's' ? true : root['esae'] === 'n' ? false : null } : {}),
    generatedDate: string(root['dg']), generatedTime: string(root['hg']),
    totalizationDate: optionalText(root['dt']), totalizationTime: optionalText(root['ht']),
    disclosureAllowed: dv === 's', progress: progress as 'n' | 'p' | 'f',
    processedPercentage: numeric(sections['pstn'] ?? sections['pst'], true),
    processedSections: numeric(sections['st']), totalSections: numeric(sections['ts']),
    validVotes: dv === 's' ? numeric(votes['vv']) : null,
    blankVotes: dv === 's' ? numeric(votes['vb']) : null,
    nullVotes: dv === 's' ? numeric(votes['tvn']) : null,
    turnout: numeric(electors['c']), turnoutPercentage: numeric(electors['pcn'] ?? electors['pc'], true),
    abstention: numeric(electors['a']), abstentionPercentage: numeric(electors['pan'] ?? electors['pa'], true),
    candidates: dv === 's' ? rankCandidates(candidates) : candidates.sort((a, b) => a.sequence - b.sequence)
  };
}
