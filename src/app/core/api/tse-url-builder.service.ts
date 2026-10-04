import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Election, ElectionConfiguration } from '../models/election.model';

@Injectable({ providedIn: 'root' })
export class TseUrlBuilderService {
  configurationUrl(baseUrl: string = environment.tseBaseUrl, source: string = environment.tseEnvironment): string {
    return `${baseUrl.replace(/\/+$/, '')}/${source}/comum/config/ele-c.json`;
  }

  private directory(config: ElectionConfiguration, election: Election, type: string, uf = 'br'): string | null {
    const template = config.directories.find(d => d.type === type)?.template;
    if (!template) return null;
    const values: Record<string, string> = {
      base: environment.tseBaseUrl.replace(/\/+$/, ''), ambiente: environment.tseEnvironment,
      ciclo: election.cycle, cd_eleicao: election.id, cd_pleito: election.contestId, uf
    };
    const path = template.replace(/<([^>]+)>/g, (_, token: string) => values[token] ?? `<${token}>`);
    if (/[<>]/.test(path) || new URL(path).origin !== new URL(environment.tseBaseUrl).origin) {
      throw new Error('Diretório EA11 inválido para a origem configurada.');
    }
    return path.replace(/\/+$/, '');
  }

  presidentUrl(config: ElectionConfiguration, election: Election, scope = 'br'): string {
    if (!/^(br|[a-z]{2})$/.test(scope) || scope === 'zz') throw new Error('UF inválida.');
    if (election.kind !== 'federal' || !election.scopes.some(s => s.code === 'br' && s.offices.some(o => Number(o.code) === 1))) {
      throw new Error('Eleição federal de Presidente não disponível.');
    }
    if (!/^\d{1,6}$/.test(election.id)) throw new Error('Código de eleição inválido.');
    const directory = this.directory(config, election, 'u', scope);
    if (!directory) throw new Error('Diretório de resultados EA20 ausente no EA11.');
    return `${directory}/${scope}-c0001-e${election.id.padStart(6, '0')}-u.json`;
  }

  candidatePhotoUrl(config: ElectionConfiguration, election: Election, candidateId: string): string | null {
    if (!/^\d+$/.test(candidateId)) return null;
    const directory = this.directory(config, election, 'ft');
    return directory ? `${directory}/${candidateId}.jpeg` : null;
  }

  trackingUrl(config: ElectionConfiguration, election: Election): string {
    if (!/^\d{1,6}$/.test(election.id)) throw new Error('Código de eleição inválido.');
    const directory = this.directory(config, election, 'ab');
    if (!directory) throw new Error('Diretório EA14 ausente no EA11.');
    return `${directory}/br-e${election.id.padStart(6, '0')}-ab.json`;
  }
}
