import { Candidate } from '../models/candidate.model';
import { ElectionResult } from '../models/election-result.model';

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

export function parsePresidentEA20(input: unknown, electionId: string, round: 1 | 2, scope = 'br'): ElectionResult {
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
  const office = offices.find(c => id(c['cd']) === '1');
  if (!office || offices.length !== 1) throw new Error('EA20 não corresponde ao cargo Presidente.');
  const federations = new Map<string, string>();
  for (const item of array(office['fed'] ?? [])) {
    const federation = object(item);
    federations.set(id(federation['n']), string(federation['sg']));
  }
  const candidates: Candidate[] = [];
  for (const item of array(office['agr'])) {
    const group = object(item);
    for (const item of array(group['par'] ?? [])) {
      const party = object(item);
      for (const item of array(party['cand'] ?? [])) {
        const candidate = object(item);
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
          photoUrl: null
        });
      }
    }
  }
  if (new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('EA20 inválido: candidatos duplicados.');
  const sections = object(root['s']);
  const electors = object(root['e']);
  const votes = object(root['v']);
  return {
    electionId: id(root['ele']), scopeCode: scope, round, phase, generationId: id(root['idg']),
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
