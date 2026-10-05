import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { PresidentComponent } from './features/president/president.component';
import { ELECTION_DATA_PROVIDER } from './core/api/election-data-provider';
import { ElectionStore } from './core/state/election.store';
import { PresidentStore } from './core/state/president.store';
import { ElectionNavigationService } from './core/services/election-navigation.service';
import { ElectionHistoryService } from './core/services/election-history.service';
import { presidentFixture, testElection } from './core/api/president-test.fixture';
import { parsePresidentEA20 } from './core/api/ea20-parser';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';

describe('Clean responsive election layout', () => {
  const error = signal<string | null>(null), loading = signal(false);
  const availableElections = signal([testElection]);
  let load: jasmine.Spy;
  beforeEach(() => {
    error.set(null); loading.set(false); availableElections.set([testElection]); load = jasmine.createSpy().and.resolveTo(undefined);
    TestBed.configureTestingModule({ imports: [AppComponent, PresidentComponent], providers: [provideRouter([]), provideNoopAnimations(),
      { provide: ELECTION_DATA_PROVIDER, useValue: {} },
      { provide: ElectionStore, useValue: { configuration: signal(null), elections: availableElections, error, loading, load, cancel: () => {} } },
      { provide: ElectionHistoryService, useValue: { read: async () => [], revision: signal(0), error: signal(null) } },
      { provide: ElectionNavigationService, useValue: { federalFilter: signal({ uf: '' }), stateFilter: signal({ uf: 'al' }), loading: signal(false), error: signal(null), states: signal(['al', 'df']),
        tabs: ['Presidente', 'Governador', 'Senador', 'Dep. Federal', 'Dep. Estadual'].map((label, id) => ({ label, id })),
        hasStateUf: () => true, disabled: () => false, office: () => 0, link: () => ['/'] } }
    ] });
  });
  async function setup() {
    const app = TestBed.createComponent(AppComponent), panel = TestBed.createComponent(PresidentComponent);
    const data = { ...presidentFixture(), md: 'e' };
    data.carg[0]!.agr[0]!.par[0]!.cand.forEach(candidate => { candidate.st = ''; });
    const result = parsePresidentEA20(data, '42', 1);
    result.candidates[0]!.name = 'NomeExtremamenteLongoSemEspaçosParaVerificarQuebraNoDispositivoMóvel';
    result.candidates[0]!.photoUrl = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='64'%20height='80'%3E%3C/svg%3E";
    result.candidates.push({ ...result.candidates[1]!, id: '999', elected: false, votes: 1 });
    TestBed.inject(PresidentStore).result.set(result);
    app.detectChanges(); panel.detectChanges(); await app.whenStable(); await panel.whenStable(); app.detectChanges(); panel.detectChanges();
    const root: HTMLElement = app.nativeElement;
    root.querySelector('mat-tab-nav-panel')!.append(panel.nativeElement);
    document.body.append(root);
    return { app, panel, root };
  }
  it('removes the catalog while retaining configuration errors and retry', async () => {
    const { app, root } = await setup(); expect(root.textContent).not.toContain('Eleições disponíveis');
    error.set('Falha de configuração'); app.detectChanges(); expect(root.textContent).toContain('Falha de configuração');
    Array.from(root.querySelectorAll('button')).find(b => b.textContent?.includes('Tentar novamente'))!.click(); expect(load.calls.count()).toBe(2);
  });
  it('renders an explicit green confirmation chip and a green border while keeping the card center unchanged', async () => {
    const { root } = await setup();
    const chip = root.querySelector<HTMLElement>('.confirmed-status')!;
    expect(chip.textContent).toContain('ELEITO · TSE'); expect(chip.title).toContain('TSE');
    expect(getComputedStyle(chip).backgroundColor).toBe('rgb(22, 163, 74)');
    expect(getComputedStyle(root.querySelector('.candidates .elected')!).borderTopColor).toBe('rgb(22, 163, 74)');
    const photo = root.querySelector('.photo')!;
    const neutral = root.querySelector('.candidates mat-card:not(.elected):not(.highlight)')!;
    expect(getComputedStyle(photo).borderTopWidth).toBe('1px');
    expect(getComputedStyle(photo).borderTopColor).toBe(getComputedStyle(neutral).borderTopColor);
  });
  it('keeps status chips and uses green, yellow and red borders with inset shadows and an unchanged card center', async () => {
    const { panel, root } = await setup();
    panel.componentInstance.pageSize.set(6);
    const result = TestBed.inject(PresidentStore).result()!;
    TestBed.inject(PresidentStore).result.set({ ...result, mathematicallyDefined: null, validVotes: null,
      candidates: ['Eleito', '2º turno', 'Não eleito', null].map((status, index) => ({ ...result.candidates[0]!, id: `${index}`, status, elected: false })) });
    panel.detectChanges();
    const neutral = root.querySelector('.candidates mat-card:not(.elected):not(.second-round):not(.not-elected)')!;
    for (const [appearance, color, text] of [
      ['elected', 'rgb(22, 163, 74)', 'ELEITO'], ['second-round', 'rgb(234, 179, 8)', '2º TURNO'], ['not-elected', 'rgb(239, 68, 68)', 'Não eleito']
    ]) {
      const card = root.querySelector(`.candidates mat-card.${appearance}`)!;
      const style = getComputedStyle(card);
      expect(style.borderTopColor).toBe(color!);
      expect(style.boxShadow).toContain(color!); expect(style.boxShadow).toContain('inset');
      expect(style.boxShadow).toContain('18px 4px');
      expect(style.backgroundColor).toBe(getComputedStyle(neutral).backgroundColor);
      expect(card.querySelector('mat-chip-set')!.textContent).toContain(text!);
      for (const chip of Array.from(card.querySelectorAll('mat-chip'))) {
        expect(getComputedStyle(chip).backgroundColor).toBe(color!);
        expect(getComputedStyle(chip.querySelector('.mat-mdc-chip-action-label')!).color).toBe('rgb(15, 23, 42)');
      }
      expect(card.classList.contains('highlight')).toBeFalse();
    }
    expect(neutral.querySelector('.official-status')!.textContent).toContain('Ainda não informada');
  });
  it('omits valid and missing vote destinations and renders other destinations in orange independently of the card status', async () => {
    const { panel, root } = await setup();
    const result = TestBed.inject(PresidentStore).result()!;
    const destinations = ['Válido', ' válido ', 'Anulado sub judice', null];
    const changed = { ...result, mathematicallyDefined: null, validVotes: null,
      candidates: destinations.map((voteDestination, index) => ({ ...result.candidates[0]!, id: `${index}`, status: 'Não eleito', elected: false, voteDestination })) };
    TestBed.inject(PresidentStore).result.set(changed); panel.detectChanges();
    const chips = root.querySelectorAll('.destination-status');
    expect(chips.length).toBe(1); expect(chips[0]!.textContent).toContain('Destinação: Anulado sub judice');
    expect(getComputedStyle(chips[0]!).backgroundColor).toBe('rgb(249, 115, 22)');
    expect(getComputedStyle(chips[0]!.closest('mat-card')!).borderTopColor).toBe('rgb(239, 68, 68)');
    expect(root.textContent).not.toContain('Destinação: Válido');
    TestBed.inject(PresidentStore).result.set({ ...changed, disclosureAllowed: false }); panel.detectChanges();
    expect(root.querySelector('.destination-status')).toBeNull();
  });
  it('fits actual CSS viewports at 320, 375, 600, 768 and 1280px, with mobile filters, scrollable tabs and one card column', async () => {
    const { root } = await setup();
    const styles = Array.from(document.querySelectorAll('style')).map(style => style.textContent).join('\n');
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => `<link rel="stylesheet" href="${link.href}">`).join('');
    for (const width of [320, 375, 600, 768, 1280]) {
      const frame = document.createElement('iframe'); frame.style.cssText = `width:${width}px;height:1200px;border:0`;
      const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
      frame.srcdoc = `<html><head>${links}<style>${styles}</style></head><body>${root.outerHTML}</body></html>`;
      document.body.append(frame); await loaded;
      try {
        const doc = frame.contentDocument!, view = frame.contentWindow!;
        expect(doc.documentElement.scrollWidth).withContext(`page overflow at ${width}px`).toBeLessThanOrEqual(view.innerWidth);
        if (width <= 600) {
          expect(view.getComputedStyle(doc.querySelector('.candidates')!).gridTemplateColumns.split(' ').length).toBe(1);
          const filters = Array.from(doc.querySelectorAll('mat-form-field')).map(field => field.getBoundingClientRect());
          expect(filters[0]!.width).toBeGreaterThan(width - 45); expect(filters[1]!.top).toBeGreaterThan(filters[0]!.top);
          const tabs = doc.querySelector<HTMLElement>('.mat-mdc-tab-link-container')!;
          expect(tabs.scrollWidth).toBeGreaterThan(tabs.clientWidth); expect(view.getComputedStyle(tabs).overflowX).toBe('auto');
        }
      } finally { frame.remove(); }
    }
  });
  it('paginates all candidates, preserves the page on updates and clamps it when the list shrinks', async () => {
    const { panel, root } = await setup();
    const store = TestBed.inject(PresidentStore), result = store.result()!;
    const candidates = Array.from({ length: 10 }, (_, i) => ({ ...result.candidates[0]!, id: `candidate-${i}`, name: `Candidato ${i}`, elected: false, status: null }));
    store.result.set({ ...result, mathematicallyDefined: null, candidates }); panel.detectChanges();
    const pager = await TestbedHarnessEnvironment.loader(panel).getHarness(MatPaginatorHarness);
    expect(root.querySelectorAll('.candidates mat-card').length).toBe(3);
    await pager.goToNextPage();
    expect(root.querySelector('.candidates')!.textContent).toContain('Candidato 3');
    expect(root.querySelector('.candidates .highlight')).toBeNull();
    const next = root.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!;
    next.focus(); expect(document.activeElement).toBe(next);
    store.result.set({ ...store.result()!, candidates: candidates.map(c => ({ ...c, votes: 99 })) }); panel.detectChanges();
    expect(panel.componentInstance.candidatePageIndex()).toBe(1);
    await pager.goToLastPage(); expect(root.querySelector('.candidates')!.textContent).toContain('Candidato 9');
    store.result.set({ ...store.result()!, candidates: candidates.slice(0, 2) }); panel.detectChanges();
    expect(panel.componentInstance.candidatePageIndex()).toBe(0);
    expect(root.querySelectorAll('.candidates mat-card').length).toBe(2);
    store.result.set({ ...store.result()!, candidates: [] }); panel.detectChanges();
    expect(root.textContent).toContain('Nenhum candidato'); expect(await pager.getRangeLabel()).toBe('0 candidatos');
    store.result.set({ ...result, candidates }); panel.detectChanges(); await pager.goToNextPage();
    availableElections.set([{ ...testElection, id: 'other-election' }]); panel.detectChanges();
    expect(panel.componentInstance.candidatePageIndex()).toBe(0);
  });
  it('opens secondary information through tabs and keeps pagination when returning to Results', async () => {
    const { panel, root } = await setup();
    const result = TestBed.inject(PresidentStore).result()!;
    TestBed.inject(PresidentStore).result.set({ ...result, candidates: Array.from({ length: 7 }, (_, i) => ({ ...result.candidates[0]!, id: `${i}` })) }); panel.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(panel);
    const tabs = await loader.getHarness(MatTabGroupHarness), pager = await loader.getHarness(MatPaginatorHarness);
    expect(root.querySelector('app-election-evolution')).toBeNull(); expect(root.querySelector('.metrics')).toBeNull();
    await pager.goToNextPage();
    await tabs.selectTab({ label: 'Detalhes da apuração' }); expect(root.querySelector('.metrics')).not.toBeNull();
    await tabs.selectTab({ label: 'Evolução' }); expect(root.querySelector('app-election-evolution')).not.toBeNull();
    await tabs.selectTab({ label: 'Resultados' }); expect(panel.componentInstance.candidatePageIndex()).toBe(1);
  });
  it('fits the default Results view in 1366×768 and 1920×1080 without hiding overflow or candidate content', async () => {
    const { panel, root } = await setup();
    const result = TestBed.inject(PresidentStore).result()!;
    const styles = () => Array.from(document.querySelectorAll('style')).map(style => style.textContent).join('\n');
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => `<link rel="stylesheet" href="${link.href}">`).join('');
    for (const [width, height, size] of [[1366, 768, 3], [1920, 1080, 6]]) {
      panel.componentInstance.pageSize.set(size!);
      TestBed.inject(PresidentStore).result.set({ ...result, candidates: Array.from({ length: 30 }, (_, i) => ({ ...result.candidates[0]!, id: `${i}`, name: `Candidato de teste ${i}`, status: 'Não eleito', elected: false })) }); panel.detectChanges();
      const frame = document.createElement('iframe'); frame.style.cssText = `width:${width}px;height:${height}px;border:0`;
      const loaded = new Promise<void>(resolve => { frame.onload = () => resolve(); });
      frame.srcdoc = `<html><head>${links}<style>${styles()}</style></head><body>${root.outerHTML}</body></html>`;
      document.body.append(frame); await loaded;
      try {
        const doc = frame.contentDocument!, view = frame.contentWindow!;
        const boxes = ['.header', 'main', '.toolbar', '.progress-summary', '.essential-metrics', '.candidates', 'mat-paginator', 'footer'].map(selector => `${selector}: ${doc.querySelector(selector)!.getBoundingClientRect().height}`).join(', ');
        expect(doc.documentElement.scrollHeight).withContext(`vertical overflow at ${width}×${height}: ${boxes}`).toBeLessThanOrEqual(view.innerHeight);
        expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(view.innerWidth);
        expect(doc.querySelectorAll('.candidates mat-card').length).toBe(size!);
        expect(view.getComputedStyle(doc.body).overflowY).not.toBe('hidden');
        expect(doc.querySelector('mat-paginator')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(view.innerHeight);
      } finally { frame.remove(); }
    }
  });
});
