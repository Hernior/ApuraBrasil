import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, convertToParamMap, Data, Router } from '@angular/router';
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
  private readonly routeData = toSignal(this.route?.data ?? of<Data>({}));
  readonly governor = computed(() => this.routeData()?.['office'] === 'governor');
  readonly officeName = computed(() => this.governor() ? 'Governador' : 'Presidente');
  readonly heading = computed(() => this.governor() ? 'Governador' : 'Presidente da República');
  readonly scope = computed(() => this.params()?.get('uf')?.toLowerCase() ?? 'br');
  readonly municipalityCode = computed(() => this.params()?.get('codigo') ?? '');
  readonly municipalities = signal<Municipality[]>([]);
  readonly governorStates = signal<string[]>([]);
  readonly availableStates = computed(() => this.governor() ? this.governorStates() : this.polling.availableStates());
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
    e.kind === (this.governor() ? 'state' : 'federal') && e.scopes.some(s =>
      (this.governor() ? s.code === 'br' || this.scope() === 'br' || s.code === this.scope() : s.code === 'br') &&
      s.offices.some(o => Number(o.code) === (this.governor() ? 3 : 1)))));
  readonly selected = computed(() => this.available().find(e => e.id === this.selectedId()) ?? this.available()[0] ?? null);

  constructor() {
    effect(() => {
      const config = this.elections.configuration();
      const election = this.selected();
      const scope = this.scope();
      const municipality = this.municipalityCode();
      const governor = this.governor();
      if (config && election) {
        untracked(() => { void this.activate(config, election, scope, municipality, governor); });
      } else if (config) {
        untracked(() => { this.municipalityController?.abort(); this.municipalityController = null; this.municipalitiesLoading.set(false); this.municipalities.set([]); this.polling.stop(); this.president.result.set(null); });
      }
    });
  }
  private async activate(config: ElectionConfiguration, election: Election, scope: string, municipality: string, governor = this.governor()): Promise<void> {
    this.municipalityController?.abort();
    const controller = new AbortController();
    this.municipalityController = controller;
    this.municipalities.set([]);
    this.governorStates.set([]);
    this.municipalitiesError.set(null);
    this.municipalitiesLoading.set(scope !== 'br' || governor);
    if (!municipality && !governor) this.polling.activate(config, election, scope);
    else { this.polling.stop(); this.president.result.set(null); this.polling.message.set(null); }
    if (scope === 'br' && !governor) return;
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
      if (governor) {
        const states = [...new Set(municipalities.map(m => m.uf))].filter(uf => election.scopes.some(s =>
          (s.code === 'br' || s.code === uf) && s.offices.some(o => Number(o.code) === 3))).sort();
        this.polling.availableStates.set(states);
        this.governorStates.set(states);
        if (scope === 'br') return;
        if (!states.includes(scope)) throw new Error('Governador não disponível nesta UF e eleição.');
      }
      if (municipality) {
        if (!this.municipalities().some(m => m.code === municipality)) throw new Error('Município não disponível nesta UF no EA12.');
        if (!governor) this.polling.availableStates.set([...new Set(municipalities.map(m => m.uf))].sort());
        this.polling.activate(config, election, `${scope}/${municipality}`);
      } else if (governor) this.polling.activate(config, election, scope);
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
    const path = this.governor() ? ['/governador', 'uf', this.scope()] : ['/uf', this.scope()];
    void this.router?.navigate(code ? [...path, 'municipio', code] : path);
  }
  selectScope(event: Event): void {
    const scope = (event.target as HTMLSelectElement).value;
    void this.router?.navigate(this.governor() ? scope === 'br' ? ['/governador'] : ['/governador', 'uf', scope] : scope === 'br' ? ['/'] : ['/uf', scope]);
  }
  selectElection(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }
  refresh(): void {
    const config = this.elections.configuration(), election = this.selected();
    if ((this.municipalitiesError() || (this.governor() && this.scope() === 'br')) && config && election) void this.activate(config, election, this.scope(), this.municipalityCode());
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
