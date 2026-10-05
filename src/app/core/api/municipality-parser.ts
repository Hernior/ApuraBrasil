export interface Municipality {
  uf: string;
  code: string;
  ibgeCode: string;
  name: string;
  capital: boolean;
}

export function parseEA12(input: unknown): { phase: 'o' | 's'; municipalities: Municipality[] } {
  const root = record(input);
  if (root['f'] !== 'o' && root['f'] !== 's') throw new Error('EA12: fase inválida.');
  if (!Array.isArray(root['abr'])) throw new Error('EA12: abrangências inválidas.');
  const municipalities: Municipality[] = [];
  const states = new Set<string>();
  for (const value of root['abr']) {
    const state = record(value);
    const uf = String(state['cd']);
    if (!/^[a-z]{2}$/.test(uf) || states.has(uf) || !Array.isArray(state['mu'])) throw new Error('EA12: UF inválida ou duplicada.');
    states.add(uf);
    const codes = new Set<string>();
    for (const value of state['mu']) {
      const city = record(value);
      const code = String(city['cd']);
      if (!/^\d{5}$/.test(code) || codes.has(code) || typeof city['nm'] !== 'string' || !city['nm'].trim() ||
          (uf !== 'zz' && !/^\d+$/.test(String(city['cdi']))) || !['s', 'n'].includes(String(city['c']))) throw new Error('EA12: município inválido ou duplicado.');
      codes.add(code);
      if (uf !== 'zz') municipalities.push({ uf, code, ibgeCode: String(city['cdi']), name: city['nm'], capital: city['c'] === 's' });
    }
  }
  return { phase: root['f'], municipalities: municipalities.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) };
}

export function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Arquivo municipal inválido.');
  return input as Record<string, unknown>;
}
