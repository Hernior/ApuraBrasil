import { ElectionTracking } from '../models/election-tracking.model';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('EA14 inválido: objeto esperado.');
  return value as Record<string, unknown>;
}
function code(value: unknown): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) throw new Error('EA14 inválido: código.');
  return String(value).replace(/^0+(?=\d)/, '');
}
function optionalText(value: unknown): string | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('EA14 inválido: texto.');
  return value;
}
// Sort object keys and scopes so presentation order and idg alone do not trigger EA20.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}
export function parseEA14(input: unknown, electionId: string, round: 1 | 2, scopeCode = 'br'): ElectionTracking {
  const root = object(input);
  const phase = root['f'];
  if (code(root['ele']) !== code(electionId) || Number(root['t']) !== round) throw new Error('EA14 de eleição ou turno diferente.');
  if (phase !== 'o' && phase !== 's') throw new Error('EA14 inválido: fase.');
  if (!Array.isArray(root['abr'])) throw new Error('EA14 inválido: abrangências.');
  const scopes = root['abr'].map(value => {
    const scope = object(value);
    if ((scope['tpabr'] !== 'br' && scope['tpabr'] !== 'uf') ||
        typeof scope['cdabr'] !== 'string' || !/^(br|[a-z]{2})$/i.test(scope['cdabr']) ||
        !['n', 'p', 'f'].includes(String(scope['and']))) throw new Error('EA14 inválido: abrangência ou andamento.');
    object(scope['s']); object(scope['e']);
    optionalText(scope['dt']); optionalText(scope['ht']);
    return scope;
  }).sort((a, b) => String(a['cdabr']).localeCompare(String(b['cdabr'])));
  if (new Set(scopes.map(s => s['cdabr'])).size !== scopes.length) throw new Error('EA14 inválido: abrangências duplicadas.');
  const national = scopes.find(s => s['tpabr'] === (scopeCode === 'br' ? 'br' : 'uf') && String(s['cdabr']).toLowerCase() === scopeCode);
  if (!national) throw new Error(scopeCode === 'br' ? 'EA14 sem abrangência Brasil.' : 'UF não disponível no acompanhamento do TSE.');
  const sections = object(national['s'])['st'];
  const processed = sections === undefined || sections === '' ? null : Number(code(sections));
  if (processed !== null && !Number.isSafeInteger(processed)) throw new Error('EA14 inválido: seções.');
  return {
    electionId: code(root['ele']), round, phase, generationId: code(root['idg']),
    availableStates: scopes.filter(s => s['tpabr'] === 'uf' && s['cdabr'] !== 'zz').map(s => String(s['cdabr']).toLowerCase()),
    signature: JSON.stringify(canonical(scopeCode === 'br' ? scopes : [national])),
    national: { date: optionalText(national['dt']), time: optionalText(national['ht']),
      processedSections: processed, progress: national['and'] as 'n' | 'p' | 'f' }
  };
}
