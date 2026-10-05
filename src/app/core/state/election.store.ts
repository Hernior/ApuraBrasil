import { computed, inject, Injectable, signal } from '@angular/core';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { ElectionConfiguration } from '../models/election.model';

@Injectable({ providedIn: 'root' })
export class ElectionStore {
  private readonly provider = inject(ELECTION_DATA_PROVIDER);
  private controller: AbortController | null = null;
  readonly configuration = signal<ElectionConfiguration | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly elections = computed(() => this.configuration()?.elections ?? []);

  async load(): Promise<void> {
    if (this.loading()) return;
    if (!navigator.onLine) {
      this.error.set('Você está offline. Conecte-se para consultar as eleições.');
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    this.loading.set(true);
    this.error.set(null);
    try {
      this.configuration.set(await this.provider.loadConfiguration(controller.signal));
    } catch (error: unknown) {
      this.error.set(controller.signal.aborted
        ? 'A consulta foi interrompida ou excedeu 15 segundos.'
        : error instanceof TypeError
          ? 'Não foi possível acessar o TSE. Verifique sua conexão; o navegador também pode ter bloqueado o acesso.'
          : error instanceof Error ? error.message : 'Não foi possível carregar as eleições.');
    } finally {
      clearTimeout(timer);
      this.controller = null;
      this.loading.set(false);
    }
  }

  cancel(): void {
    this.controller?.abort();
  }
}
