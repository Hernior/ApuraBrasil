import { computed, effect, inject, Injectable, OnDestroy, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith, tap } from 'rxjs';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { ElectionConfiguration } from '../models/election.model';
import { ElectionStore } from '../state/election.store';
import { ElectionPollingService } from './election-polling.service';
import { TseRequestError } from '../api/tse-request-error';

export type ElectionTab = 'president' | 'governor' | 'senator' | 'federal-deputy' | 'state-deputy';
interface GeographicFilter { uf: string; municipality: string; }

@Injectable({ providedIn: 'root' })
export class ElectionNavigationService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly elections = inject(ElectionStore);
  private readonly provider = inject(ELECTION_DATA_PROVIDER);
  private readonly polling = inject(ElectionPollingService);
  private controller: AbortController | null = null;
  readonly federalFilter = signal<GeographicFilter>({ uf: '', municipality: '' });
  readonly stateFilter = signal<GeographicFilter>({ uf: '', municipality: '' });
  readonly tabs: { id: ElectionTab; label: string; path: string }[] = [
    { id: 'president', label: 'Presidente', path: '' },
    { id: 'governor', label: 'Governador', path: 'governador' },
    { id: 'senator', label: 'Senador', path: 'senador' },
    { id: 'federal-deputy', label: 'Dep. Federal', path: 'deputado-federal' },
    { id: 'state-deputy', label: 'Dep. Estadual', path: 'deputado-estadual' }
  ];
  private snapshot() {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return { uf: String(route.params['uf'] ?? '').toLowerCase(), municipality: String(route.params['codigo'] ?? ''), office: (route.data['office'] ?? 'president') as ElectionTab };
  }
  private readonly location = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd), map(() => this.snapshot()), startWith(this.snapshot()),
    tap(location => {
      const group = location.office === 'president' ? this.federalFilter : this.stateFilter;
      group.set({ uf: location.uf, municipality: location.municipality });
    })
  ), { requireSync: true });
  readonly uf = computed(() => this.location().uf);
  readonly municipality = computed(() => this.location().municipality);
  readonly office = computed(() => this.location().office);
  readonly states = signal<string[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasStateUf = computed(() => this.states().includes(this.stateFilter().uf));

  constructor() {
    effect(() => {
      const config = this.elections.configuration();
      if (config) untracked(() => { void this.loadStates(config); });
    });
  }
  private async loadStates(config: ElectionConfiguration): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const election = config.elections.find(e => e.kind === 'federal' && e.round === 1) ?? config.elections[0];
    if (!election) { this.states.set([]); this.loading.set(false); this.error.set(null); return; }
    this.loading.set(true); this.error.set(null);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      if (!navigator.onLine) throw new Error('Você está offline. Reconecte para carregar as UFs.');
      if (!this.polling.canRequest()) throw new Error('Consulta de UFs pausada após limitação do TSE.');
      const municipalities = await this.provider.loadMunicipalities(config, election, controller.signal);
      if (this.controller === controller && !controller.signal.aborted) this.states.set([...new Set(municipalities.map(m => m.uf))].sort());
    } catch (error: unknown) {
      if (this.controller === controller) {
        if (error instanceof TseRequestError && error.status === 429) this.polling.rateLimited(error);
        this.error.set(controller.signal.aborted ? 'A consulta de UFs excedeu o tempo limite.' : error instanceof Error ? error.message : 'Não foi possível carregar as UFs.');
      }
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.loading.set(false);
    }
  }
  retry(): void {
    const config = this.elections.configuration();
    if (config && !this.loading()) void this.loadStates(config);
  }
  disabled(tab: ElectionTab): boolean { return tab !== 'president' && !this.hasStateUf(); }
  link(tab: ElectionTab): string[] {
    const { uf, municipality } = tab === 'president' ? this.federalFilter() : this.stateFilter();
    if (!uf || !this.states().includes(uf)) return ['/'];
    const path = this.tabs.find(t => t.id === tab)!.path;
    const commands = path ? ['/', path, 'uf', uf] : ['/', 'uf', uf];
    return municipality ? [...commands, 'municipio', municipality] : commands;
  }
  selectFederalUf(uf: string): void {
    if (uf && !this.states().includes(uf)) return;
    if (uf === this.federalFilter().uf) return;
    this.federalFilter.set({ uf, municipality: '' });
    if (this.office() === 'president') void this.router.navigate(this.link('president'));
  }
  selectStateUf(uf: string): void {
    if (uf && !this.states().includes(uf)) return;
    if (uf === this.stateFilter().uf) return;
    this.stateFilter.set({ uf, municipality: '' });
    if (this.office() !== 'president') void this.router.navigate(this.link(uf ? this.office() : 'president'));
  }
  ngOnDestroy(): void { this.controller?.abort(); this.controller = null; }
}
