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
    if (!/^(br|[a-z]{2})(?:\/[0-9]{5})?$/.test(scope) || scope.startsWith('zz') || scope.startsWith('br/')) throw new Error('UF ou município inválido.');
    if (election.kind !== 'federal' || !election.scopes.some(s => s.code === 'br' && s.offices.some(o => Number(o.code) === 1))) {
      throw new Error('Eleição federal de Presidente não disponível.');
    }
    if (!/^\d{1,6}$/.test(election.id)) throw new Error('Código de eleição inválido.');
    const directory = this.directory(config, election, 'u', scope.split('/')[0]);
    if (!directory) throw new Error('Diretório de resultados EA20 ausente no EA11.');
    return `${directory}/${scope.replace('/', '')}-c0001-e${election.id.padStart(6, '0')}-u.json`;
  }

  governorUrl(config: ElectionConfiguration, election: Election, scope: string): string {
    return this.stateResultUrl(config, election, scope, '3');
  }
  senatorUrl(config: ElectionConfiguration, election: Election, scope: string): string {
    if (election.round !== 1) throw new Error('Senador não possui segundo turno.');
    return this.stateResultUrl(config, election, scope, '5');
  }
  federalDeputyUrl(config: ElectionConfiguration, election: Election, scope: string): string {
    if (election.round !== 1) throw new Error('Deputado Federal não possui segundo turno.');
    return this.stateResultUrl(config, election, scope, '6');
  }
  stateDeputyUrl(config: ElectionConfiguration, election: Election, scope: string): string {
    if (election.round !== 1) throw new Error('Deputado Estadual/Distrital não possui segundo turno.');
    return this.stateResultUrl(config, election, scope, scope.split('/')[0] === 'df' ? '8' : '7');
  }
  private stateResultUrl(config: ElectionConfiguration, election: Election, scope: string, officeCode: '3' | '5' | '6' | '7' | '8'): string {
    const officeName = officeCode === '3' ? 'Governador' : officeCode === '5' ? 'Senador' : officeCode === '6' ? 'Deputado Federal' : officeCode === '7' ? 'Deputado Estadual' : 'Deputado Distrital';
    const uf = scope.split('/')[0]!;
    if (!/^[a-z]{2}(?:\/[0-9]{5})?$/.test(scope) || uf === 'br' || uf === 'zz') throw new Error(`UF ou município de ${officeName} inválido.`);
    if (election.kind !== 'state' || !election.scopes.some(s => (s.code === 'br' || s.code === uf) && s.offices.some(o => o.code.replace(/^0+/, '') === officeCode))) throw new Error(`${officeName} não disponível nesta eleição e UF.`);
    if (!/^\d{1,6}$/.test(election.id)) throw new Error('Código de eleição inválido.');
    const directory = this.directory(config, election, 'u', uf);
    if (!directory) throw new Error('Diretório de resultados EA20 ausente no EA11.');
    return `${directory}/${scope.replace('/', '')}-c${officeCode.padStart(4, '0')}-e${election.id.padStart(6, '0')}-u.json`;
  }

  candidatePhotoUrl(config: ElectionConfiguration, election: Election, candidateId: string, uf = 'br'): string | null {
    if (!/^\d+$/.test(candidateId)) return null;
    const directory = this.directory(config, election, 'ft', uf);
    return directory ? `${directory}/${candidateId}.jpeg` : null;
  }

  municipalitiesUrl(config: ElectionConfiguration, election: Election): string {
    if (!/^\d{1,6}$/.test(election.id)) throw new Error('Código de eleição inválido.');
    const directory = this.directory(config, election, 'cm');
    if (!directory) throw new Error('Diretório EA12 ausente no EA11.');
    return `${directory}/mun-e${election.id.padStart(6, '0')}-cm.json`;
  }

  trackingUrl(config: ElectionConfiguration, election: Election, uf = 'br'): string {
    if (!/^(br|[a-z]{2})$/.test(uf) || uf === 'zz') throw new Error('UF inválida.');
    if (!/^\d{1,6}$/.test(election.id)) throw new Error('Código de eleição inválido.');
    const directory = this.directory(config, election, 'ab', uf);
    if (!directory) throw new Error('Diretório EA14 ausente no EA11.');
    return `${directory}/${uf}-e${election.id.padStart(6, '0')}-ab.json`;
  }
}
