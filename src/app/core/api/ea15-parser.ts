import { ElectionTracking } from '../models/election-tracking.model';
import { parseEA14 } from './ea14-parser';
import { record } from './municipality-parser';

// EA15 belongs to the state election. Only section counters are comparable to President.
export function parseEA15(input: unknown, electionId: string, round: 1 | 2, uf: string, municipality: string): ElectionTracking {
  const root = record(input);
  if (!Array.isArray(root['abr'])) throw new Error('EA15: abrangências inválidas.');
  const scopes = root['abr'].map(record);
  if (!scopes.some(s => s['tpabr'] === 'uf' && s['cdabr'] === uf)) throw new Error('EA15 de outra UF.');
  const cities = scopes.filter(s => s['tpabr'] === 'mun');
  if (cities.some(s => !/^\d{5}$/.test(String(s['cdabr']))) || new Set(cities.map(s => s['cdabr'])).size !== cities.length) throw new Error('EA15: municípios inválidos ou duplicados.');
  const selected = cities.find(s => s['cdabr'] === municipality);
  if (!selected) throw new Error('Município não disponível no EA15.');
  const tracking = parseEA14({ ...root, abr: [{ ...selected, tpabr: 'uf', cdabr: uf }] }, electionId, round, uf);
  tracking.national.date = null;
  tracking.national.time = null;
  tracking.national.progress = tracking.national.processedSections ? 'p' : 'n';
  return tracking;
}
