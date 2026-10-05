import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, NgZone, OnDestroy, signal, untracked, viewChild } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import type { EChartsType } from 'echarts/core';
import { ElectionHistoryContext, ElectionSnapshot, historyContextKey } from '../../core/models/election-snapshot.model';
import { ElectionHistoryService } from '../../core/services/election-history.service';
import { buildEvolutionModel, EvolutionLimit, EvolutionMetric } from './evolution-model';

@Component({
  selector: 'app-election-evolution',
  imports: [DecimalPipe, MatButtonToggleModule],
  templateUrl: './election-evolution.component.html',
  styleUrl: './election-evolution.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ElectionEvolutionComponent implements OnDestroy {
  readonly context = input.required<ElectionHistoryContext | null>();
  readonly history = inject(ElectionHistoryService);
  readonly snapshots = signal<ElectionSnapshot[]>([]);
  readonly loading = signal(false);
  readonly chartError = signal(false);
  readonly showTable = signal(false);
  readonly limit = signal<EvolutionLimit>('2');
  readonly metric = signal<EvolutionMetric>('percentage');
  readonly model = computed(() => buildEvolutionModel(this.snapshots(), this.limit()));
  readonly latest = computed(() => this.snapshots().at(-1));
  readonly chartAvailable = computed(() => this.model().series.some(series => series.points.some(point => point.processedPercentage !== null && (this.metric() === 'votes' ? point.votes : point.percentage) !== null)));
  private readonly element = viewChild<ElementRef<HTMLElement>>('chart');
  private readonly zone = inject(NgZone);
  private chart: EChartsType | null = null;
  private observer: ResizeObserver | null = null;
  private readRequest = 0;
  private renderRequest = 0;
  private previousContext: string | null = null;
  private destroyed = false;

  constructor() {
    effect(() => {
      const context = this.context();
      this.history.revision();
      untracked(() => { void this.load(context); });
    });
    effect(() => {
      const element = this.element()?.nativeElement;
      const model = this.model();
      const available = this.chartAvailable();
      const metric = this.metric();
      untracked(() => { void this.render(element, model, available, metric); });
    });
  }

  private async load(context: ElectionHistoryContext | null): Promise<void> {
    const request = ++this.readRequest;
    const key = context ? historyContextKey(context) : null;
    if (key !== this.previousContext) { this.snapshots.set([]); this.previousContext = key; }
    this.loading.set(!!context);
    const snapshots = context ? await this.history.read(context) : [];
    if (!this.destroyed && request === this.readRequest) { this.snapshots.set(snapshots); this.loading.set(false); }
  }

  private async render(element: HTMLElement | undefined, model: ReturnType<typeof buildEvolutionModel>, available: boolean, metric: EvolutionMetric): Promise<void> {
    const request = ++this.renderRequest;
    if (!element || !available) { this.chart?.clear(); return; }
    try {
      const renderer = await import('./evolution-chart');
      if (this.destroyed || request !== this.renderRequest) return;
      this.zone.runOutsideAngular(() => {
        if (!this.chart) {
          this.chart = renderer.createEvolutionChart(element);
          this.observer = new ResizeObserver(() => this.chart?.resize());
          this.observer.observe(element);
        }
        this.chart.resize();
        this.chart.setOption(renderer.evolutionOptions(model, metric), { notMerge: true });
      });
      this.chartError.set(false);
    } catch {
      if (!this.destroyed && request === this.renderRequest) this.chartError.set(true);
    }
  }

  selectLimit(value: EvolutionLimit): void { this.limit.set(value); }
  selectMetric(value: EvolutionMetric): void { this.metric.set(value); }
  ngOnDestroy(): void { this.destroyed = true; this.observer?.disconnect(); this.chart?.dispose(); }
}
