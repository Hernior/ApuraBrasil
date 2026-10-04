import { computed, inject, Injectable, NgZone, signal } from '@angular/core';
import { ELECTION_DATA_PROVIDER } from '../api/election-data-provider';
import { TseRequestError } from '../api/tse-request-error';
import { Election, ElectionConfiguration } from '../models/election.model';
import { ElectionTracking } from '../models/election-tracking.model';
import { ElectionResult } from '../models/election-result.model';
import { PresidentStore } from '../state/president.store';

export type PollingInterval = 0 | 15000 | 30000 | 60000;
function timestamp(date: string | null, time: string | null): string {
  return date && time ? date.split('/').reverse().join('-') + 'T' + time : '';
}
export function resultCoversTracking(result: ElectionResult, tracking: ElectionTracking): boolean {
  const marker = timestamp(tracking.national.date, tracking.national.time);
  return (!marker || timestamp(result.totalizationDate, result.totalizationTime) >= marker) &&
    (tracking.national.processedSections === null || (result.processedSections ?? -1) >= tracking.national.processedSections) &&
    (tracking.national.progress !== 'f' || result.progress === 'f');
}

@Injectable({ providedIn: 'root' })
export class ElectionPollingService {
  private readonly provider = inject(ELECTION_DATA_PROVIDER);
  private readonly president = inject(PresidentStore);
  private readonly zone = inject(NgZone);
  private context: { config: ElectionConfiguration; election: Election; scope: string } | null = null;
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private signature: string | null = null;
  private failures = 0;
  private blockedUntil = 0;
  private listening = false;
  readonly availableStates = signal<string[]>([]);
  readonly interval = signal<PollingInterval>(15000);
  readonly checking = signal(false);
  readonly message = signal<string | null>(null);
  readonly suspended = signal(false);
  readonly lastCheckedAt = signal<number | null>(null);
  readonly lastResultAt = signal<number | null>(null);
  readonly live = computed(() => this.interval() > 0 && !this.suspended() && !this.message() &&
    this.lastResultAt() !== null && (this.lastCheckedAt() ?? Date.now()) - this.lastResultAt()! <= 90000 &&
    this.president.result()?.phase === 'o' && this.president.result()?.disclosureAllowed === true &&
    this.president.result()?.progress === 'p' && this.recentGeneration());

  private recentGeneration(): boolean {
    const result = this.president.result();
    if (!result) return false;
    const generated = Date.parse(timestamp(result.generatedDate, result.generatedTime) + '-03:00');
    const age = Date.now() - generated;
    return Number.isFinite(age) && age >= -60000 && age <= 90000;
  }
  private readonly environmentChanged = () => {
    if (!this.context) return;
    if (document.hidden || !navigator.onLine) {
      this.cancelCheck();
      this.suspended.set(true);
    } else {
      this.suspended.set(false);
      void this.check(true);
    }
  };

  activate(config: ElectionConfiguration, election: Election, scope = 'br'): void {
    this.stop();
    this.context = { config, election, scope };
    if (this.president.result()?.electionId !== election.id || this.president.result()?.scopeCode !== scope) this.president.result.set(null);
    this.signature = null;
    this.lastResultAt.set(null);
    this.lastCheckedAt.set(null);
    this.message.set(Date.now() < this.blockedUntil ? 'Consultas temporariamente pausadas após limitação do TSE.' : null);
    this.failures = 0;
    document.addEventListener('visibilitychange', this.environmentChanged);
    window.addEventListener('online', this.environmentChanged);
    window.addEventListener('offline', this.environmentChanged);
    this.listening = true;
    this.environmentChanged();
  }

  setInterval(value: number): void {
    if (![0, 15000, 30000, 60000].includes(value)) throw new Error('Intervalo de atualização inválido.');
    this.interval.set(value as PollingInterval);
    this.clearTimer();
    this.schedule();
  }

  async refresh(): Promise<void> { await this.check(true); }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
  private cancelCheck(): void {
    this.clearTimer();
    this.controller?.abort();
    this.controller = null;
    this.president.cancel();
    this.checking.set(false);
  }
  stop(): void {
    this.suspended.set(true);
    this.cancelCheck();
    this.context = null;
    if (this.listening) {
      document.removeEventListener('visibilitychange', this.environmentChanged);
      window.removeEventListener('online', this.environmentChanged);
      window.removeEventListener('offline', this.environmentChanged);
      this.listening = false;
    }
  }

  private schedule(): void {
    this.clearTimer();
    if (!this.context || !this.interval() || document.hidden || !navigator.onLine) return;
    const backoff = this.failures ? Math.min(600000, 30000 * 2 ** Math.min(this.failures - 1, 5)) : 0;
    const delay = Math.max(this.interval(), backoff, this.blockedUntil - Date.now());
    this.zone.runOutsideAngular(() => {
      this.timer = setTimeout(() => this.zone.run(() => { void this.check(); }), delay);
    });
  }

  private async check(force = false): Promise<void> {
    const context = this.context;
    if (!context || this.checking()) return;
    this.clearTimer();
    if (document.hidden || !navigator.onLine) { this.suspended.set(true); return; }
    if (Date.now() < this.blockedUntil) { this.schedule(); return; }
    const controller = new AbortController();
    this.controller = controller;
    this.checking.set(true);
    this.suspended.set(false);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const tracking = await this.provider.loadTracking(context.config, context.election, controller.signal, context.scope);
      clearTimeout(timeout);
      if (this.controller !== controller) return;
      this.availableStates.set(tracking.availableStates);
      this.lastCheckedAt.set(Date.now());
      const previous = this.president.result();
      const changed = this.signature !== tracking.signature;
      if (force || changed || !previous) {
        const ok = await this.president.load(context.config, context.election, context.scope);
        if (this.controller !== controller) return;
        if (!ok) throw this.president.failure() ?? new TypeError('Falha na atualização de Presidente.');
        const result = this.president.result()!;
        if (resultCoversTracking(result, tracking) &&
            (force || this.signature === null || result.generationId !== previous?.generationId)) {
          this.signature = tracking.signature;
          this.message.set(null);
        } else {
          this.message.set('Aguardando a sincronização dos arquivos do TSE.');
        }
        if (result.generationId !== previous?.generationId) this.lastResultAt.set(Date.now());
      } else {
        this.message.set(null);
      }
      this.failures = 0;
    } catch (error: unknown) {
      if (this.controller !== controller) return;
      this.failures++;
      if (error instanceof TseRequestError && error.status === 429) {
        const delay = Math.max(600000, error.retryAfterMs, Math.min(3600000, 600000 * 2 ** Math.min(this.failures - 1, 3)));
        this.blockedUntil = Date.now() + delay;
        this.message.set('O TSE limitou as consultas. Atualização pausada por pelo menos 10 minutos.');
      } else if (error instanceof TseRequestError && error.status === 404) {
        this.blockedUntil = Date.now() + Math.max(60000, Math.min(600000, 60000 * 2 ** Math.min(this.failures - 1, 4)));
        this.message.set('Arquivo ainda indisponível no TSE (404). Nova consulta será adiada.');
      } else if (error instanceof TypeError || error instanceof TseRequestError || controller.signal.aborted ||
                 (error instanceof DOMException && error.name === 'AbortError')) {
        this.message.set('Falha ao atualizar. A próxima tentativa terá um intervalo maior.');
      } else {
        this.interval.set(0);
        this.message.set(error instanceof Error ? error.message + ' Atualização automática suspensa.' : 'Atualização automática suspensa.');
      }
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) {
        this.controller = null;
        this.checking.set(false);
        this.schedule();
      }
    }
  }
}
