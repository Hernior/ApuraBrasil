import { inject, Injectable, signal } from '@angular/core';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { Election, ElectionConfiguration } from '../models/election.model';
import { ElectionResult } from '../models/election-result.model';

@Injectable({ providedIn: 'root' })
export class PresidentStore {
  private readonly provider = inject(ELECTION_DATA_PROVIDER);
  private controller: AbortController | null = null;
  readonly result = signal<ElectionResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly failure = signal<unknown>(null);

  async load(config: ElectionConfiguration, election: Election): Promise<boolean> {
    this.controller?.abort();
    if (this.result()?.electionId !== election.id) this.result.set(null);
    const controller = new AbortController();
    this.controller = controller;
    this.error.set(null);
    this.failure.set(null);
    if (!navigator.onLine) {
      this.error.set('Você está offline. Os dados anteriores, se disponíveis, permanecem na tela.');
      this.loading.set(false);
      return false;
    }
    this.loading.set(true);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await this.provider.loadPresident(config, election, controller.signal);
      if (this.controller === controller) { this.result.set(result); return true; }
      return false;
    } catch (error: unknown) {
      if (this.controller === controller) {
        this.failure.set(error);
        this.error.set(controller.signal.aborted ? 'A consulta excedeu o tempo limite ou foi interrompida.'
          : error instanceof TypeError ? 'Falha de conexão ao TSE ou bloqueio de acesso pelo navegador.'
          : error instanceof Error ? error.message : 'Não foi possível consultar Presidente.');
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) {
        this.loading.set(false);
        this.controller = null;
      }
    }
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.loading.set(false);
  }
}
