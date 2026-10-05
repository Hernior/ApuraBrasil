import { LOCALE_ID, signal } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { parsePresidentEA20 } from '../../core/api/ea20-parser';
import { presidentFixture } from '../../core/api/president-test.fixture';
import { createElectionSnapshot, ElectionHistoryContext, ElectionSnapshot } from '../../core/models/election-snapshot.model';
import { ElectionHistoryService } from '../../core/services/election-history.service';
import { ElectionEvolutionComponent } from './election-evolution.component';

registerLocaleData(localePt);

describe('Election evolution panel', () => {
  let read: jasmine.Spy;
  let fixture: ComponentFixture<ElectionEvolutionComponent>;
  const error = signal<string | null>(null), revision = signal(0);
  const snapshot = () => createElectionSnapshot(parsePresidentEA20(presidentFixture(), '42', 1));
  async function settle() { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); }
  beforeEach(async () => {
    await import('./evolution-chart');
    error.set(null); revision.set(0); read = jasmine.createSpy().and.resolveTo([]);
    TestBed.configureTestingModule({ imports: [ElectionEvolutionComponent], providers: [provideNoopAnimations(),
      { provide: LOCALE_ID, useValue: 'pt-BR' },
      { provide: ElectionHistoryService, useValue: { read, error, revision } }] });
    fixture = TestBed.createComponent(ElectionEvolutionComponent);
    fixture.componentRef.setInput('context', snapshot());
  });
  it('renders a real SVG chart, the one-record notice and historical data table', async () => {
    read.and.resolveTo([snapshot()]); await settle();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.chart svg')).not.toBeNull();
    expect(element.textContent).toContain('Primeiro registro disponível');
    expect(element.querySelector('.chart')!.textContent).toContain('Seções totalizadas (%)');
    const details = element.querySelector('details')!; details.open = true; details.dispatchEvent(new Event('toggle')); await settle();
    expect(element.querySelector('caption')!.textContent).toContain('Histórico local');
    expect(element.querySelector('tbody')!.textContent).toContain('57,14%');
    expect(element.querySelector('tbody')!.textContent).toContain('40 votos');
  });
  it('updates Top 2/3/5/All from the controls and refreshes when a new observation is saved', async () => {
    const value = snapshot();
    value.candidates = Array.from({ length: 6 }, (_, index) => ({ ...value.candidates[0]!, id: `${index}`, number: `${index}`, votes: index, percentage: index }));
    read.and.resolveTo([value]); await settle();
    for (const [label, length] of [['Top 3', 3], ['Top 5', 5], ['Todos', 6], ['Top 2', 2]] as const) {
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('mat-button-toggle button')).find(button => button.textContent?.trim() === label)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle(); expect(fixture.componentInstance.model().series.length).toBe(length);
    }
    read.and.resolveTo([value, { ...value, generatedTime: '18:00:00' }]); revision.update(v => v + 1); await settle();
    expect(fixture.nativeElement.textContent).toContain('2 registro(s)');
    expect(fixture.nativeElement.textContent).toContain('18:00:00');
  });
  it('clears a previous scope immediately and ignores an older asynchronous read', async () => {
    let resolveFirst!: (value: ElectionSnapshot[]) => void;
    read.and.returnValue(new Promise<ElectionSnapshot[]>(resolve => { resolveFirst = resolve; }));
    fixture.detectChanges();
    const context: ElectionHistoryContext = { ...snapshot(), scopeCode: 'al' };
    read.and.resolveTo([{ ...snapshot(), scopeCode: 'al', generatedTime: '19:00:00' }]);
    fixture.componentRef.setInput('context', context); fixture.detectChanges();
    expect(fixture.componentInstance.snapshots()).toEqual([]);
    resolveFirst([{ ...snapshot(), generatedTime: '17:00:00' }]); await settle();
    expect(fixture.componentInstance.latest()?.scopeCode).toBe('al');
    expect(fixture.nativeElement.textContent).toContain('19:00:00'); expect(fixture.nativeElement.textContent).not.toContain('17:00:00');
  });
  it('shows storage and disclosure notices without a chart or hidden voting', async () => {
    const value = { ...snapshot(), disclosureAllowed: false, candidates: [] };
    read.and.resolveTo([value]); error.set('Histórico indisponível'); await settle();
    expect(fixture.nativeElement.textContent).toContain('Histórico indisponível');
    expect(fixture.nativeElement.textContent).toContain('ainda não autorizou');
    expect(fixture.nativeElement.querySelector('.chart').hidden).toBeTrue();
    expect(fixture.nativeElement.querySelector('details')).toBeNull();
  });
  it('switches the rendered chart to absolute votes and back without reading history or changing the selected candidates', async () => {
    read.and.resolveTo([snapshot()]); await settle();
    const element: HTMLElement = fixture.nativeElement;
    const reads = read.calls.count();
    fixture.componentInstance.selectLimit('5'); await settle();
    const selected = fixture.componentInstance.model().candidates.map(candidate => candidate.id);
    Array.from(element.querySelectorAll('.metric button')).find(button => button.textContent?.trim() === 'Votos absolutos')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(fixture.componentInstance.metric()).toBe('votes');
    expect(element.querySelector('.chart')!.textContent).toContain('Votos acumulados');
    expect(element.querySelector('.chart')!.textContent).not.toContain('Percentual TSE (%)');
    expect(fixture.componentInstance.limit()).toBe('5'); expect(fixture.componentInstance.model().candidates.map(candidate => candidate.id)).toEqual(selected);
    Array.from(element.querySelectorAll('.metric button')).find(button => button.textContent?.trim() === 'Percentual')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(element.querySelector('.chart')!.textContent).toContain('Percentual TSE (%)'); expect(read.calls.count()).toBe(reads);
  });
  it('shows known absolute votes even when the official candidate percentage is missing', async () => {
    const value = snapshot(); value.candidates = value.candidates.map(candidate => ({ ...candidate, percentage: null }));
    read.and.resolveTo([value]); await settle();
    expect(fixture.componentInstance.chartAvailable()).toBeFalse();
    fixture.componentInstance.selectMetric('votes'); await settle();
    expect(fixture.componentInstance.chartAvailable()).toBeTrue(); expect(fixture.nativeElement.querySelector('.chart svg')).not.toBeNull();
    fixture.componentInstance.selectMetric('percentage'); await settle(); expect(fixture.componentInstance.chartAvailable()).toBeFalse();
  });
});
