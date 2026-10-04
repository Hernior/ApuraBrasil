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
}
