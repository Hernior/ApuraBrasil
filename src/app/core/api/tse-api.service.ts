import { Election, ElectionConfiguration } from '../models/election.model';
import { parsePresidentEA20 } from './ea20-parser';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ElectionDataProvider } from './election-data-provider';
import { TseParserService } from './tse-parser.service';
import { TseUrlBuilderService } from './tse-url-builder.service';

@Injectable({ providedIn: 'root' })
export class TseApiService implements ElectionDataProvider {
  private readonly urls = inject(TseUrlBuilderService);
  private readonly parser = inject(TseParserService);

  async loadConfiguration(signal: AbortSignal) {
    const response = await fetch(this.urls.configurationUrl(), { signal, credentials: 'omit', cache: 'no-cache' });
    if (response.status === 404) throw new Error('A configuração das eleições ainda não está disponível no TSE (404).');
    if (response.status === 429) throw new Error('Limite de consultas atingido (429). Aguarde antes de tentar novamente.');
    if (!response.ok) throw new Error(`O TSE respondeu com HTTP ${response.status}.`);
    const configuration = this.parser.parseEA11(await response.json() as unknown);
    if (environment.production && configuration.phase !== 'o') {
      throw new Error('Configuração de simulado recusada no ambiente de produção.');
    }
    return configuration;
  }

  async loadPresident(config: ElectionConfiguration, election: Election, signal: AbortSignal) {
    const response = await fetch(this.urls.presidentUrl(config, election), { signal, credentials: 'omit', cache: 'no-cache' });
    if (response.status === 404) throw new Error('Resultado de Presidente ainda não disponível no TSE (404).');
    if (response.status === 429) throw new Error('Limite de consultas atingido (429). Aguarde antes de atualizar.');
    if (!response.ok) throw new Error(`O TSE respondeu com HTTP ${response.status}.`);
    const result = parsePresidentEA20(await response.json() as unknown, election.id, election.round);
    if (environment.production && result.phase !== 'o') throw new Error('Resultado de simulado recusado em produção.');
    result.candidates = result.candidates.map(candidate => ({
      ...candidate, photoUrl: this.urls.candidatePhotoUrl(config, election, candidate.id)
    }));
    return result;
  }
}
