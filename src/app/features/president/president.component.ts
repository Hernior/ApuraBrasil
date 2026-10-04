import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { ElectionPollingService } from '../../core/services/election-polling.service';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ElectionStore } from '../../core/state/election.store';
import { PresidentStore } from '../../core/state/president.store';
import { ELECTION_DATA_PROVIDER } from '../../core/api/election-data-provider';
import { Municipality } from '../../core/api/municipality-parser';
import { Election, ElectionConfiguration } from '../../core/models/election.model';
import { TseRequestError } from '../../core/api/tse-request-error';

@Component({
  selector: 'app-president',
  imports: [DecimalPipe, MatButtonModule, MatCardModule],
  templateUrl: './president.component.html',
  styleUrl: './president.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PresidentComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly params = toSignal(this.route?.paramMap ?? of(convertToParamMap({})));
  readonly scope = computed(() => this.params()?.get('uf')?.toLowerCase() ?? 'br');
  readonly municipalityCode = computed(() => this.params()?.get('codigo') ?? '');
  readonly municipalities = signal<Municipality[]>([]);
  readonly municipalitiesError = signal<string | null>(null);
  readonly municipalitiesLoading = signal(false);
  readonly municipality = computed(() => this.municipalities().find(m => m.code === this.municipalityCode()));
  private readonly provider = inject(ELECTION_DATA_PROVIDER);
  private municipalityController: AbortController | null = null;
  readonly elections = inject(ElectionStore);
  readonly president = inject(PresidentStore);
  readonly polling = inject(ElectionPollingService);
  readonly selectedId = signal<string | null>(null);
  readonly failedPhotos = signal<Set<string>>(new Set());
  readonly available = computed(() => this.elections.elections().filter(e =>
    e.kind === 'federal' && e.scopes.some(s => s.code === 'br' && s.offices.some(o => Number(o.code) === 1))));
  readonly selected = computed(() => this.available().find(e => e.id === this.selectedId()) ?? this.available()[0] ?? null);

  constructor() {
    effect(() => {
      const config = this.elections.configuration();
      const election = this.selected();
      const scope = this.scope();
      const municipality = this.municipalityCode();
      if (config && election) {
        untracked(() => { void this.activate(config, election, scope, municipality); });
      } else if (config) {
        untracked(() => { this.polling.stop(); this.president.result.set(null); });
      }
    });
  }
  private async activate(config: ElectionConfiguration, election: Election, scope: string, municipality: string): Promise<void> {
    this.municipalityController?.abort();
    const controller = new AbortController();
    this.municipalityController = controller;
    this.municipalities.set([]);
    this.municipalitiesError.set(null);
    this.municipalitiesLoading.set(scope !== 'br');
    if (!municipality) this.polling.activate(config, election, scope);
    else { this.polling.stop(); this.president.result.set(null); this.polling.message.set(null); }
    if (scope === 'br') return;
    if (!navigator.onLine || !this.polling.canRequest()) {
      this.municipalitiesLoading.set(false);
      this.municipalitiesError.set(!navigator.onLine ? 'Você está offline. Atualize os municípios ao reconectar.' : 'Consulta de municípios pausada após limitação do TSE.');
      return;
    }
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const municipalities = await this.provider.loadMunicipalities(config, election, controller.signal);
      if (this.municipalityController !== controller || controller.signal.aborted) return;
      this.municipalities.set(municipalities.filter(m => m.uf === scope));
      if (municipality) {
        if (!this.municipalities().some(m => m.code === municipality)) throw new Error('Município não disponível nesta UF no EA12.');
        this.polling.availableStates.set([...new Set(municipalities.map(m => m.uf))].sort());
        this.polling.activate(config, election, `${scope}/${municipality}`);
      }
    } catch (error: unknown) {
      if (this.municipalityController === controller) {
        if (error instanceof TseRequestError && error.status === 429) this.polling.rateLimited(error);
        this.municipalitiesError.set(controller.signal.aborted ? 'Consulta de municípios interrompida ou excedeu o tempo limite.' : error instanceof Error ? error.message : 'Falha ao consultar municípios.');
      }
    } finally {
      clearTimeout(timeout);
      if (this.municipalityController === controller) this.municipalitiesLoading.set(false);
    }
  }
  selectMunicipality(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    void this.router?.navigate(code ? ['/uf', this.scope(), 'municipio', code] : ['/uf', this.scope()]);
  }
  selectScope(event: Event): void {
    const scope = (event.target as HTMLSelectElement).value;
    void this.router?.navigate(scope === 'br' ? ['/'] : ['/uf', scope]);
  }
  selectElection(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }
  refresh(): void {
    const config = this.elections.configuration(), election = this.selected();
    if (this.municipalitiesError() && config && election) void this.activate(config, election, this.scope(), this.municipalityCode());
    else void this.polling.refresh();
  }
  selectInterval(event: Event): void {
    this.polling.setInterval(Number((event.target as HTMLSelectElement).value));
  }
  photoFailed(id: string): void {
    this.failedPhotos.update(ids => new Set([...ids, id]));
  }
  ngOnDestroy(): void { this.municipalityController?.abort(); this.municipalityController = null; this.polling.stop(); }
}
