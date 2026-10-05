import { Injectable } from '@angular/core';
import { Election, ElectionConfiguration } from '../models/election.model';

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Configuração EA11 inválida: objeto esperado.');
  }
  return value as Record<string, unknown>;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Configuração EA11 inválida: lista esperada.');
  return value;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Configuração EA11 inválida: texto obrigatório ausente.');
  }
  return value;
}
function code(value: unknown): string {
  const result = typeof value === 'number' ? String(value) : text(value);
  if (!/^\d+$/.test(result)) throw new Error('Configuração EA11 inválida: código numérico esperado.');
  return result;
}

@Injectable({ providedIn: 'root' })
export class TseParserService {
  parseEA11(input: unknown): ElectionConfiguration {
    const root = record(input);
    const phase = text(root['f']);
    if (phase !== 'o' && phase !== 's') throw new Error('Fase EA11 inválida.');
    const elections: Election[] = [];
    for (const item of list(root['pl'])) {
      const contest = record(item);
      if (contest['c'] !== 'ele2026') continue;
      for (const entry of list(contest['e'])) {
        const election = record(entry);
        const type = Number(code(election['tp']));
        if (type !== 1 && type !== 8) continue;
        const round = Number(code(election['t']));
        if (round !== 1 && round !== 2) throw new Error('Turno EA11 inválido.');
        elections.push({
          id: code(election['cd']),
          name: text(election['nm']),
          type,
          kind: type === 8 ? 'federal' : 'state',
          round,
          secondRoundId: election['cdt2'] === undefined || election['cdt2'] === '' ? null : code(election['cdt2']),
          contestId: code(contest['cd']),
          cycle: text(contest['c']),
          date: text(contest['dt']),
          scopes: list(election['abr']).map(value => {
            const scope = record(value);
            return {
              code: text(scope['cd']).toLowerCase(),
              offices: list(scope['cp']).map(value => {
                const office = record(value);
                return { code: code(office['cd']), name: text(office['ds']), type: Number(code(office['tp'])) };
              })
            };
          })
        });
      }
    }
    const keys = elections.map(e => e.id);
    if (new Set(keys).size !== keys.length) throw new Error('Códigos de eleição duplicados no EA11.');
    return {
      generatedDate: text(root['dg']),
      generatedTime: text(root['hg']),
      generationId: code(root['idg']),
      phase,
      directories: list(root['arq']).map(value => {
        const directory = record(value);
        return { type: text(directory['tp']), template: text(directory['dir']) };
      }),
      elections: elections.sort((a, b) => a.round - b.round || a.kind.localeCompare(b.kind))
    };
  }
}
