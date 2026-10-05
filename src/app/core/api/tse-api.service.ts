import { parseEA14 } from './ea14-parser';
import { parseEA15 } from './ea15-parser';
import { Municipality, parseEA12 } from './municipality-parser';
import { TseRequestError, retryAfterMilliseconds } from './tse-request-error';
import { Election, ElectionConfiguration } from '../models/election.model';
import { ElectionTracking } from '../models/election-tracking.model';
import { parseFederalDeputyEA20, parseGovernorEA20, parsePresidentEA20, parseSenatorEA20, parseStateDeputyEA20 } from './ea20-parser';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ElectionDataProvider } from './election-data-provider';
import { TseParserService } from './tse-parser.service';
import { TseUrlBuilderService } from './tse-url-builder.service';

@Injectable({ providedIn: 'root' })
export class TseApiService implements ElectionDataProvider {
  private readonly urls = inject(TseUrlBuilderService);
  private readonly parser = inject(TseParserService);
  private readonly municipalities = new Map<string, Municipality[]>();

  async loadMunicipalities(config: ElectionConfiguration, election: Election, signal: AbortSignal): Promise<Municipality[]> {
    const url = this.urls.municipalitiesUrl(config, election);
    const key = `${config.generationId}:${url}`;
    const cached = this.municipalities.get(key);
    if (cached) return cached;
    const response = await fetch(url, { signal, credentials: 'omit', cache: 'no-cache' });
    if (!response.ok) throw new TseRequestError(response.status, `Municípios indisponíveis (HTTP ${response.status}).`, retryAfterMilliseconds(response.headers.get('Retry-After')));
    const result = parseEA12(await response.json() as unknown);
    if (environment.production && result.phase !== 'o') throw new Error('Municípios de simulado recusados em produção.');
    if (!signal.aborted) { this.municipalities.clear(); this.municipalities.set(key, result.municipalities); }
    return result.municipalities;
  }

  private async validateMunicipality(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string): Promise<void> {
    const [uf, code] = scope.split('/');
    if (!(await this.loadMunicipalities(config, election, signal)).some(m => m.uf === uf && m.code === code)) throw new Error('Município não disponível nesta UF no EA12.');
  }

  async loadConfiguration(signal: AbortSignal) {
    const response = await fetch(this.urls.configurationUrl(), { signal, credentials: 'omit', cache: 'no-cache' });
    if (response.status === 404) throw new Error('A configuração das eleições ainda não está disponível no TSE (404).');
    if (response.status === 429) throw new Error('Limite de consultas atingido (429). Aguarde antes de tentar novamente.');
    if (!response.ok) throw new TseRequestError(response.status, `O TSE respondeu com HTTP ${response.status}.`);
    const configuration = this.parser.parseEA11(await response.json() as unknown);
    if (environment.production && configuration.phase !== 'o') {
      throw new Error('Configuração de simulado recusada no ambiente de produção.');
    }
    return configuration;
  }

  async loadPresident(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope = 'br') {
    const result = await this.loadPresidentResult(config, election, signal, scope);
    if (scope !== 'br') result.nationalResult = await this.loadPresidentResult(config, election, signal, 'br');
    return result;
  }
  private async loadPresidentResult(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string) {
    if (scope.includes('/')) await this.validateMunicipality(config, election, signal, scope);
    const response = await fetch(this.urls.presidentUrl(config, election, scope), { signal, credentials: 'omit', cache: 'no-cache' });
    if (response.status === 404) throw new TseRequestError(404, 'Resultado de Presidente ainda não disponível no TSE (404).');
    if (response.status === 429) throw new TseRequestError(429, 'Limite de consultas atingido (429). Aguarde antes de atualizar.', retryAfterMilliseconds(response.headers.get('Retry-After')));
    if (!response.ok) throw new TseRequestError(response.status, `O TSE respondeu com HTTP ${response.status}.`);
    const result = parsePresidentEA20(await response.json() as unknown, election.id, election.round, scope);
    if (environment.production && result.phase !== 'o') throw new Error('Resultado de simulado recusado em produção.');
    result.candidates = result.candidates.map(candidate => ({
      ...candidate, photoUrl: this.urls.candidatePhotoUrl(config, election, candidate.id)
    }));
    return result;
  }

  async loadGovernor(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string) {
    return this.loadWithUfResult(config, election, signal, scope, '3');
  }
  async loadSenator(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string) {
    return this.loadWithUfResult(config, election, signal, scope, '5');
  }
  async loadFederalDeputy(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string) {
    return this.loadWithUfResult(config, election, signal, scope, '6');
  }
  async loadStateDeputy(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string) {
    return this.loadWithUfResult(config, election, signal, scope, scope.split('/')[0] === 'df' ? '8' : '7');
  }
  private async loadWithUfResult(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string, officeCode: '3' | '5' | '6' | '7' | '8') {
    const result = await this.loadStateResult(config, election, signal, scope, officeCode);
    if (scope.includes('/')) result.stateResult = await this.loadStateResult(config, election, signal, scope.split('/')[0]!, officeCode);
    return result;
  }
  private async loadStateResult(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope: string, officeCode: '3' | '5' | '6' | '7' | '8') {
    const officeName = officeCode === '3' ? 'Governador' : officeCode === '5' ? 'Senador' : officeCode === '6' ? 'Deputado Federal' : officeCode === '7' ? 'Deputado Estadual' : 'Deputado Distrital';
    const url = officeCode === '3' ? this.urls.governorUrl(config, election, scope) : officeCode === '5' ? this.urls.senatorUrl(config, election, scope) : officeCode === '6' ? this.urls.federalDeputyUrl(config, election, scope) : this.urls.stateDeputyUrl(config, election, scope);
    const [uf, municipality] = scope.split('/');
    const cities = await this.loadMunicipalities(config, election, signal);
    if (!cities.some(m => m.uf === uf && (!municipality || m.code === municipality))) throw new Error(`UF ou município de ${officeName} não disponível no EA12.`);
    const response = await fetch(url, { signal, credentials: 'omit', cache: 'no-cache' });
    if (!response.ok) throw new TseRequestError(response.status, `Resultado de ${officeName} indisponível (HTTP ${response.status}).`, retryAfterMilliseconds(response.headers.get('Retry-After')));
    const input: unknown = await response.json();
    const result = officeCode === '3' ? parseGovernorEA20(input, election.id, election.round, scope) : officeCode === '5' ? parseSenatorEA20(input, election.id, election.round, scope) : officeCode === '6' ? parseFederalDeputyEA20(input, election.id, election.round, scope) : parseStateDeputyEA20(input, election.id, election.round, scope);
    if (environment.production && result.phase !== 'o') throw new Error('Resultado de simulado recusado em produção.');
    result.candidates = result.candidates.map(candidate => ({ ...candidate, photoUrl: this.urls.candidatePhotoUrl(config, election, candidate.id, uf) }));
    return result;
  }

  async loadTracking(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope = 'br', officeCode?: '1' | '3' | '5' | '6' | '7' | '8'): Promise<ElectionTracking> {
    if (election.kind === 'state' && (!/^[a-z]{2}(?:\/[0-9]{5})?$/.test(scope) || /^(br|zz)(\/|$)/.test(scope) ||
        !election.scopes.some(s => s.code === 'br' || s.code === scope.split('/')[0]))) throw new Error('Abrangência estadual indisponível no EA11.');
    const [uf, municipality] = scope.split('/');
    const stateElection = municipality ? election.kind === 'state' ? [election] : config.elections.filter(e => e.kind === 'state' && e.cycle === election.cycle && e.date === election.date && e.round === election.round && e.scopes.some(s => s.code === uf || s.code === 'br')) : [];
    if (municipality) {
      await this.validateMunicipality(config, election, signal, scope);
      if (!stateElection.length) return {
        electionId: election.id, round: election.round, phase: config.phase, generationId: config.generationId,
        availableStates: [], signature: `manual:${scope}`,
        national: { date: null, time: null, processedSections: null, progress: 'n' as const },
        manualNotice: 'Acompanhamento municipal indisponível para este turno. Use Atualizar Presidente para consultar os resultados.'
      };
      if (stateElection.length !== 1) throw new Error('Mais de uma eleição estadual corresponde ao acompanhamento municipal.');
    }
    const trackingElection = municipality ? stateElection[0]! : election;
    const response = await fetch(this.urls.trackingUrl(config, trackingElection, municipality ? uf : 'br'), { signal, credentials: 'omit', cache: 'no-cache' });
    if (!response.ok) throw new TseRequestError(response.status, `Acompanhamento do TSE indisponível (HTTP ${response.status}).`, retryAfterMilliseconds(response.headers.get('Retry-After')));
    const input: unknown = await response.json();
    let result = municipality ? parseEA15(input, trackingElection.id, election.round, uf, municipality) : parseEA14(input, election.id, election.round, scope);
    if (environment.production && result.phase !== 'o') throw new Error('Acompanhamento de simulado recusado em produção.');
    if (election.kind === 'federal' && scope !== 'br') {
      const nationalTracking = municipality ? await this.loadTracking(config, election, signal, 'br', '1') : parseEA14(input, election.id, election.round, 'br');
      result = { ...result, nationalTracking, signature: JSON.stringify([result.signature, nationalTracking.signature]) };
    }
    if (municipality && ['3', '5', '6', '7', '8'].includes(officeCode ?? (election.kind === 'state' ? '3' : '1'))) {
      const stateTracking = await this.loadTracking(config, election, signal, uf);
      return { ...result, stateTracking, signature: JSON.stringify([result.signature, stateTracking.signature]) };
    }
    return result;
  }
}
