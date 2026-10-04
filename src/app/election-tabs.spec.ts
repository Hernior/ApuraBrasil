import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { ELECTION_DATA_PROVIDER } from './core/api/election-data-provider';
import { parseGovernorEA20, parsePresidentEA20 } from './core/api/ea20-parser';
import { parseEA14 } from './core/api/ea14-parser';
import { governorConfiguration, governorFixture, governorTrackingFixture } from './core/api/governor-test.fixture';
import { presidentFixture, trackingFixture } from './core/api/president-test.fixture';
import { ElectionNavigationService } from './core/services/election-navigation.service';
import { ElectionPollingService } from './core/services/election-polling.service';

describe('Election tabs and shared UF', () => {
  let loadPresident: jasmine.Spy, loadGovernor: jasmine.Spy;
  beforeEach(() => {
    loadPresident = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope: string) => parsePresidentEA20({ ...presidentFixture(), tpabr: scope.includes('/') ? 'mu' : scope === 'br' ? 'br' : 'uf', cdabr: scope.split('/')[1] ?? scope }, '42', 1, scope));
    loadGovernor = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope: string) => parseGovernorEA20(governorFixture(scope), '43', 1, scope));
    TestBed.configureTestingModule({ imports: [AppComponent], providers: [provideRouter(routes), provideNoopAnimations(), { provide: ELECTION_DATA_PROVIDER, useValue: {
      loadConfiguration: async () => governorConfiguration, loadPresident, loadGovernor,
      loadTracking: async (_c: unknown, e: { kind: string; id: string }, _s: unknown, scope: string) => parseEA14(e.kind === 'state' ? governorTrackingFixture() : trackingFixture(), e.id, 1, scope.split('/')[0]),
      loadMunicipalities: async () => [{ uf: 'al', code: '00001', ibgeCode: '2700001', name: 'Cidade teste', capital: true }, { uf: 'df', code: '97012', ibgeCode: '5300108', name: 'Brasília', capital: true }]
    } }] });
  });
  afterEach(() => TestBed.inject(ElectionPollingService).stop());
  async function settle(fixture: ComponentFixture<AppComponent>) {
    fixture.detectChanges(); await fixture.whenStable();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  }
  async function setup(path = '/') {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl(path);
    await settle(fixture);
    return fixture;
  }
  function tab(element: HTMLElement, name: string): HTMLAnchorElement {
    return Array.from(element.querySelectorAll<HTMLAnchorElement>('a[mat-tab-link]')).find(link => link.textContent?.trim() === name)!;
  }
  it('shows five Material tabs and disables all state tabs without a selected UF', async () => {
    const fixture = await setup(); const element = fixture.nativeElement as HTMLElement;
    const links = element.querySelectorAll('a[mat-tab-link]');
    expect(links.length).toBe(5);
    expect(tab(element, 'Presidente').getAttribute('aria-disabled')).not.toBe('true');
    for (const name of ['Governador', 'Senador', 'Dep. Federal', 'Dep. Estadual']) {
      expect(tab(element, name).getAttribute('aria-disabled')).toBe('true');
      tab(element, name).click();
    }
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
    expect(loadGovernor).not.toHaveBeenCalled();
  });
  it('enables state tabs after choosing a UF and opens Governor in that UF', async () => {
    const fixture = await setup();
    TestBed.inject(ElectionNavigationService).selectUf('al');
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(Router).url).toBe('/uf/al');
    for (const name of ['Governador', 'Senador', 'Dep. Federal', 'Dep. Estadual']) expect(tab(element, name).getAttribute('aria-disabled')).not.toBe('true');
    tab(element, 'Governador').click();
    await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/governador/uf/al');
    expect(loadGovernor.calls.mostRecent().args[3]).toBe('al');
  });
  it('preserves UF and municipality across Governor and pending tabs without new result queries', async () => {
    const fixture = await setup('/uf/al/municipio/00001'); const element = fixture.nativeElement as HTMLElement;
    tab(element, 'Governador').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/governador/uf/al/municipio/00001');
    expect(loadGovernor.calls.mostRecent().args[3]).toBe('al/00001');
    const count = loadGovernor.calls.count() + loadPresident.calls.count();
    for (const [name, path] of [['Senador', 'senador'], ['Dep. Federal', 'deputado-federal'], ['Dep. Estadual', 'deputado-estadual']]) {
      tab(element, name!).click(); await settle(fixture);
      expect(TestBed.inject(Router).url).toBe(`/${path}/uf/al/municipio/00001`);
      expect(element.textContent).toContain('Em implementação');
      expect(loadGovernor.calls.count() + loadPresident.calls.count()).toBe(count);
      expect(TestBed.inject(ElectionPollingService).checking()).toBeFalse();
    }
    tab(element, 'Presidente').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/uf/al/municipio/00001');
  });
  it('returns to national President and disables state tabs after removing the UF', async () => {
    const fixture = await setup('/governador/uf/al');
    TestBed.inject(ElectionNavigationService).selectUf('');
    await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(loadPresident.calls.mostRecent().args[3]).toBe('br');
    expect(tab(fixture.nativeElement, 'Governador').getAttribute('aria-disabled')).toBe('true');
  });
  it('loads UF options for a direct pending route and clears the municipality when changing UF', async () => {
    const fixture = await setup('/senador/uf/al/municipio/00001');
    const navigation = TestBed.inject(ElectionNavigationService);
    expect(navigation.hasUf()).toBeTrue();
    expect(navigation.states()).toEqual(['al', 'df']);
    expect(loadPresident).not.toHaveBeenCalled(); expect(loadGovernor).not.toHaveBeenCalled();
    navigation.selectUf('df'); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/senador/uf/df');
    expect(navigation.municipality()).toBe('');
  });
});
