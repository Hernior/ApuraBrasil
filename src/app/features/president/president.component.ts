import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, convertToParamMap, Data, Router } from '@angular/router';
import { of } from 'rxjs';
import { ElectionPollingService } from '../../core/services/election-polling.service';
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { BreakpointObserver } from '@angular/cdk/layout';
import { buildElectionShareSummary } from './share-election-summary';
import { ShareResultDialogComponent } from './share-result-dialog.component';
import { ElectionStore } from '../../core/state/election.store';
import { PresidentStore } from '../../core/state/president.store';
import { ELECTION_DATA_PROVIDER } from '../../core/api/election-data-provider';
import { Municipality } from '../../core/api/municipality-parser';
import { Election, ElectionConfiguration } from '../../core/models/election.model';
import { TseRequestError } from '../../core/api/tse-request-error';
import { senatorProjection } from '../../core/services/senator-projection';
import { ElectionEvolutionComponent } from '../evolution/election-evolution.component';
import { ElectionHistoryContext } from '../../core/models/election-snapshot.model';
import { decisionResult, electionDecisions } from '../../core/services/election-decisions';

function candidatePaginatorLabels(): MatPaginatorIntl {
  const labels = new MatPaginatorIntl();
  labels.itemsPerPageLabel = 'Candidatos por página';
  labels.nextPageLabel = 'Próxima página'; labels.previousPageLabel = 'Página anterior';
  labels.firstPageLabel = 'Primeira página'; labels.lastPageLabel = 'Última página';
  labels.getRangeLabel = (page, size, length) => length ? `${page * size + 1}–${Math.min((page + 1) * size, length)} de ${length}` : '0 candidatos';
  return labels;
}

@Component({
  selector: 'app-president',
  imports: [DecimalPipe, MatButtonModule, MatCardModule, MatChipsModule, MatTabsModule, MatPaginatorModule, ElectionEvolutionComponent],
  providers: [{ provide: MatPaginatorIntl, useFactory: candidatePaginatorLabels }],
  templateUrl: './president.component.html',
  styleUrls: ['./president.component.scss', './president-responsive.component.scss', './president-dashboard.component.scss', './president-candidates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PresidentComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly params = toSignal(this.route?.paramMap ?? of(convertToParamMap({})));
  private readonly routeData = toSignal(this.route?.data ?? of<Data>({}));
  readonly governor = computed(() => this.routeData()?.['office'] === 'governor');
  readonly senator = computed(() => this.routeData()?.['office'] === 'senator');
  readonly federalDeputy = computed(() => this.routeData()?.['office'] === 'federal-deputy');
  readonly stateDeputy = computed(() => this.routeData()?.['office'] === 'state-deputy');
  readonly proportional = computed(() => this.federalDeputy() || this.stateDeputy());
  readonly stateOffice = computed(() => this.governor() || this.senator() || this.proportional());
  readonly officeCode = computed<'1' | '3' | '5' | '6' | '7' | '8'>(() => this.stateDeputy() ? this.scope() === 'df' ? '8' : '7' : this.federalDeputy() ? '6' : this.senator() ? '5' : this.governor() ? '3' : '1');
  readonly officeName = computed(() => this.stateDeputy() ? this.scope() === 'df' ? 'Deputado Distrital' : 'Deputado Estadual' : this.federalDeputy() ? 'Deputado Federal' : this.senator() ? 'Senador' : this.governor() ? 'Governador' : 'Presidente');
  readonly statePath = computed(() => this.stateDeputy() ? '/deputado-estadual' : this.federalDeputy() ? '/deputado-federal' : this.senator() ? '/senador' : '/governador');
  readonly heading = computed(() => this.stateOffice() ? this.officeName() : 'Presidente da República');
  readonly scope = computed(() => this.params()?.get('uf')?.toLowerCase() ?? 'br');
  readonly municipalityCode = computed(() => this.params()?.get('codigo') ?? '');
  readonly municipalities = signal<Municipality[]>([]);
  readonly governorStates = signal<string[]>([]);
  readonly availableStates = computed(() => this.stateOffice() ? this.governorStates() : this.polling.availableStates());
  readonly municipalitiesError = signal<string | null>(null);
  readonly municipalitiesLoading = signal(false);
  readonly municipality = computed(() => this.municipalities().find(m => m.code === this.municipalityCode()));
  private readonly provider = inject(ELECTION_DATA_PROVIDER);
  private municipalityController: AbortController | null = null;
  readonly elections = inject(ElectionStore);
  readonly president = inject(PresidentStore);
  readonly polling = inject(ElectionPollingService);
  readonly statewideResult = computed(() => { const result = this.president.result(); return this.proportional() || this.senator() ? result?.stateResult ?? result : null; });
  readonly allocationResult = computed(() => this.proportional() ? this.statewideResult() : null);
  readonly allocation = computed(() => this.allocationResult()?.allocation);
  readonly calculatedWinners = computed(() => new Set(this.allocation()?.winners.map(w => w.candidateId) ?? []));
  readonly senatorProjection = computed(() => senatorProjection(this.senator() ? this.statewideResult() : null));
  readonly senatorLeaders = computed(() => new Set(this.senatorProjection().candidateIds));
  readonly decisionAuthority = computed(() => decisionResult(this.president.result()));
  readonly decisions = computed(() => electionDecisions(this.president.result()));
  readonly statewideCandidates = computed(() => new Map(this.decisionAuthority()?.candidates.map(c => [c.id, c]) ?? []));
  officialStatus(id: string, localStatus: string | null): string {
    return (this.decisionAuthority() ? this.statewideCandidates().get(id)?.status : this.scope() === 'br' ? localStatus : null) || 'Ainda não informada pelo TSE';
  }
  showOfficialStatus(id: string, status: string | null): boolean {
    const decision = this.decisions().get(id);
    return !(decision?.label === 'ELEITO' && decision.source === 'TSE' && /^eleit[oa](?:$|\s+por\s)/i.test(this.officialStatus(id, status).trim()));
  }
  candidateAppearance(id: string, status: string | null): 'elected' | 'second-round' | 'not-elected' | 'provisional' | '' {
    const calculated = this.proportional() && this.calculatedWinners().has(id);
    const decision = this.decisions().get(id);
    if (decision) return decision.label === '2º TURNO' ? 'second-round' : 'elected';
    const official = this.officialStatus(id, status).trim();
    if (/^eleit[oa](?:$|\s+por\s)/i.test(official) || (calculated && this.allocation()?.final)) return 'elected';
    if (/^2[º°o]?\s*turno$/i.test(official)) return 'second-round';
    if (calculated || (this.senator() && this.senatorLeaders().has(id))) return 'provisional';
    return /^não eleit[oa]$/i.test(official) ? 'not-elected' : '';
  }
  readonly selectedId = signal<string | null>(null);
  readonly failedPhotos = signal<Set<string>>(new Set());
  readonly pageIndex = signal(0);
  readonly pageSize = signal<number | null>(null);
  private readonly roomyViewport = toSignal(inject(BreakpointObserver).observe('(min-width: 1600px) and (min-height: 900px)'), { initialValue: { matches: false, breakpoints: {} } });
  readonly candidatePageSize = computed(() => this.pageSize() ?? (this.roomyViewport().matches ? 6 : 3));
  readonly candidatePageIndex = computed(() => Math.min(this.pageIndex(), Math.max(0, Math.ceil((this.president.result()?.candidates.length ?? 0) / this.candidatePageSize()) - 1)));
  readonly pagedCandidates = computed(() => this.president.result()?.candidates.slice(this.candidatePageIndex() * this.candidatePageSize(), (this.candidatePageIndex() + 1) * this.candidatePageSize()) ?? []);
  changeCandidatePage(event: PageEvent): void { this.pageSize.set(event.pageSize); this.pageIndex.set(event.pageIndex); }
  readonly available = computed(() => this.elections.elections().filter(e =>
    (!(this.senator() || this.proportional()) || e.round === 1) && e.kind === (this.stateOffice() ? 'state' : 'federal') && e.scopes.some(s =>
      (this.stateOffice() ? s.code === 'br' || this.scope() === 'br' || s.code === this.scope() : s.code === 'br') &&
      s.offices.some(o => Number(o.code) === Number(this.officeCode())))));
  readonly selected = computed(() => this.available().find(e => e.id === this.selectedId()) ?? this.available()[0] ?? null);
  readonly shareableResult = computed(() => {
    const result = this.president.result();
    const scope = this.municipalityCode() ? `${this.scope()}/${this.municipalityCode()}` : this.scope();
    return result && result.electionId === this.selected()?.id && result.scopeCode === scope &&
      (result.officeCode ?? '1') === this.officeCode() ? result : null;
  });
  readonly historyContext = computed<ElectionHistoryContext | null>(() => {
    const election = this.selected();
    if (!election || (this.stateOffice() && this.scope() === 'br')) return null;
    return { electionId: election.id, officeCode: this.officeCode(), round: election.round,
      scopeCode: this.municipalityCode() ? `${this.scope()}/${this.municipalityCode()}` : this.scope(),
      phase: this.shareableResult()?.phase ?? this.elections.configuration()?.phase ?? 'o' };
  });

  share(): void {
    const result = this.shareableResult();
    if (!result) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = this.router?.url ?? url.hash;
    const location = this.scope() === 'br' ? 'Brasil · incluindo o exterior' : this.municipalityCode()
      ? `${this.municipality()?.name ?? this.municipalityCode()} · ${this.scope().toUpperCase()}` : `Toda a UF · ${this.scope().toUpperCase()}`;
    const text = buildElectionShareSummary({
      result, officeName: this.officeName(), location, url: url.href,
      officialStatus: candidate => this.officialStatus(candidate.id, candidate.status),
      confirmedStatus: candidate => {
        const decision = this.decisions().get(candidate.id);
        return decision ? `${decision.label} — ${decision.source}. ${decision.explanation}` : '';
      },
      calculatedStatus: candidate => this.decisions().has(candidate.id) ? '' : this.proportional() && this.calculatedWinners().has(candidate.id)
        ? this.allocation()?.final ? 'Eleito pelo cálculo de vagas da UF' : 'Provisoriamente na faixa de eleição da UF'
        : this.senator() && this.candidateAppearance(candidate.id, candidate.status) === 'provisional'
          ? 'Provisoriamente na faixa de eleição da UF' : '',
      notice: this.president.error() ? 'Últimos dados recebidos: a atualização falhou.'
        : this.polling.suspended() ? 'Atualização pausada; confira o horário do arquivo.' : undefined
    });
    this.dialog.open(ShareResultDialogComponent, { data: text, width: '640px', maxWidth: 'calc(100vw - 32px)' });
  }

  constructor() {
    effect(() => {
      // Polling keeps the page; changing cargo, location or election resets it.
      this.scope(); this.municipalityCode(); this.officeCode(); this.selected()?.id;
      this.pageIndex.set(0);
    });
    effect(() => {
      const config = this.elections.configuration();
      const election = this.selected();
      const scope = this.scope();
      const municipality = this.municipalityCode();
      const governor = this.stateOffice();
      const officeCode = this.officeCode();
      if (config && election) {
        untracked(() => { void this.activate(config, election, scope, municipality, governor, officeCode); });
      } else if (config) {
        untracked(() => { this.municipalityController?.abort(); this.municipalityController = null; this.municipalitiesLoading.set(false); this.municipalities.set([]); this.polling.stop(); this.president.result.set(null); });
      }
    });
  }
  private async activate(config: ElectionConfiguration, election: Election, scope: string, municipality: string, governor = this.stateOffice(), officeCode = this.officeCode()): Promise<void> {
    this.municipalityController?.abort();
    const controller = new AbortController();
    this.municipalityController = controller;
    this.municipalities.set([]);
    this.governorStates.set([]);
    this.municipalitiesError.set(null);
    this.municipalitiesLoading.set(scope !== 'br' || governor);
    if (!municipality && !governor) this.polling.activate(config, election, scope, officeCode);
    else { this.polling.stop(); this.president.result.set(null); this.president.error.set(null); this.polling.message.set(null); }
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
          (s.code === 'br' || s.code === uf) && s.offices.some(o => Number(o.code) === Number(officeCode)))).sort();
        this.polling.availableStates.set(states);
        this.governorStates.set(states);
        if (scope === 'br') return;
        if (!states.includes(scope)) throw new Error('Cargo não disponível nesta UF e eleição.');
      }
      if (municipality) {
        if (!this.municipalities().some(m => m.code === municipality)) throw new Error('Município não disponível nesta UF no EA12.');
        if (!governor) this.polling.availableStates.set([...new Set(municipalities.map(m => m.uf))].sort());
        this.polling.activate(config, election, `${scope}/${municipality}`, officeCode);
      } else if (governor) this.polling.activate(config, election, scope, officeCode);
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
    const path = this.stateOffice() ? [this.statePath(), 'uf', this.scope()] : ['/uf', this.scope()];
    void this.router?.navigate(code ? [...path, 'municipio', code] : path);
  }
  selectScope(event: Event): void {
    const scope = (event.target as HTMLSelectElement).value;
    void this.router?.navigate(this.stateOffice() ? scope === 'br' ? ['/'] : [this.statePath(), 'uf', scope] : scope === 'br' ? ['/'] : ['/uf', scope]);
  }
  selectElection(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }
  refresh(): void {
    const config = this.elections.configuration(), election = this.selected();
    if ((this.municipalitiesError() || (this.stateOffice() && this.scope() === 'br')) && config && election) void this.activate(config, election, this.scope(), this.municipalityCode());
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
