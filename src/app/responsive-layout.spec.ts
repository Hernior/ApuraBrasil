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

describe('Clean responsive election layout', () => {
  const error = signal<string | null>(null), loading = signal(false);
  let load: jasmine.Spy;
  beforeEach(() => {
    error.set(null); loading.set(false); load = jasmine.createSpy().and.resolveTo(undefined);
    TestBed.configureTestingModule({ imports: [AppComponent, PresidentComponent], providers: [provideRouter([]), provideNoopAnimations(),
      { provide: ELECTION_DATA_PROVIDER, useValue: {} },
      { provide: ElectionStore, useValue: { configuration: signal(null), elections: signal([testElection]), error, loading, load, cancel: () => {} } },
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
    expect(getComputedStyle(chip).getPropertyValue('--mdc-chip-elevated-container-color').trim()).toBe('#15803d');
    expect(getComputedStyle(root.querySelector('.candidates .elected')!).borderTopColor).toBe('rgb(22, 163, 74)');
    const photo = root.querySelector('.photo')!;
    const neutral = root.querySelector('.candidates mat-card:not(.elected):not(.highlight)')!;
    expect(getComputedStyle(photo).borderTopWidth).toBe('1px');
    expect(getComputedStyle(photo).borderTopColor).toBe(getComputedStyle(neutral).borderTopColor);
  });
  it('keeps status chips and uses green, yellow and red borders with inset shadows and an unchanged card center', async () => {
    const { panel, root } = await setup();
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
      expect(card.classList.contains('highlight')).toBeFalse();
    }
    expect(neutral.querySelector('.official-status')!.textContent).toContain('Ainda não informada');
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
});
