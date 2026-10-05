import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { ELECTION_DATA_PROVIDER } from './core/api/election-data-provider';
import { parseFederalDeputyEA20, parseGovernorEA20, parsePresidentEA20, parseSenatorEA20, parseStateDeputyEA20 } from './core/api/ea20-parser';
import { parseEA14 } from './core/api/ea14-parser';
import { governorFixture, governorTrackingFixture } from './core/api/governor-test.fixture';
import { presidentFixture, trackingFixture } from './core/api/president-test.fixture';
import { ElectionNavigationService } from './core/services/election-navigation.service';
import { ElectionPollingService } from './core/services/election-polling.service';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { senatorFixture } from './core/api/senator-test.fixture';
import { deputyFixture } from './core/api/federal-deputy-test.fixture';
import { stateDeputyConfiguration, stateDeputyFixture } from './core/api/state-deputy-test.fixture';

describe('Election tabs with independent federal and state filters', () => {
  let loadPresident: jasmine.Spy, loadGovernor: jasmine.Spy, loadSenator: jasmine.Spy, loadFederalDeputy: jasmine.Spy, loadStateDeputy: jasmine.Spy;
  beforeEach(() => {
    loadPresident = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope: string) => parsePresidentEA20({ ...presidentFixture(), tpabr: scope.includes('/') ? 'mu' : scope === 'br' ? 'br' : 'uf', cdabr: scope.split('/')[1] ?? scope }, '42', 1, scope));
    loadGovernor = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope: string) => parseGovernorEA20(governorFixture(scope), '43', 1, scope));
    loadSenator = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope: string) => {
      const result = parseSenatorEA20(senatorFixture(scope), '43', 1, scope);
      if (scope.includes('/')) result.stateResult = parseSenatorEA20(senatorFixture(scope.split('/')[0]), '43', 1, scope.split('/')[0]);
      return result;
    });
    loadStateDeputy = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope: string) => {
      const result = parseStateDeputyEA20(stateDeputyFixture(scope), '43', 1, scope);
      if (scope.includes('/')) result.stateResult = parseStateDeputyEA20(stateDeputyFixture(scope.split('/')[0]), '43', 1, scope.split('/')[0]);
      return result;
    });
    loadFederalDeputy = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope: string) => {
      const result = parseFederalDeputyEA20(deputyFixture(scope), '43', 1, scope);
      if (scope.includes('/')) result.stateResult = parseFederalDeputyEA20(deputyFixture(scope.split('/')[0]), '43', 1, scope.split('/')[0]);
      return result;
    });
    TestBed.configureTestingModule({ imports: [AppComponent], providers: [provideRouter(routes), provideNoopAnimations(), { provide: ELECTION_DATA_PROVIDER, useValue: {
      loadConfiguration: async () => stateDeputyConfiguration, loadPresident, loadGovernor, loadSenator, loadFederalDeputy, loadStateDeputy,
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
  it('renders state deputy municipality allocation and switches to district deputy in DF, keeping federal geography', async () => {
    const fixture = await setup('/deputado-estadual/uf/al/municipio/00001'); const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toBe('Deputado Estadual');
    expect(element.querySelectorAll('.candidates mat-card.provisional').length).toBe(3);
    expect(element.textContent).toContain('Distribuição de 3 vagas');
    expect(element.textContent).toContain('Os votos abaixo são do município');
    TestBed.inject(ElectionNavigationService).selectStateUf('df'); await settle(fixture);
    expect(element.querySelector('h2')?.textContent).toBe('Deputado Distrital');
    expect(element.textContent).not.toContain('Deputado Estadual · AL');
    expect(loadStateDeputy.calls.mostRecent().args[3]).toBe('df');
    tab(element, 'Presidente').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(TestBed.inject(ElectionNavigationService).stateFilter().uf).toBe('df');
  });
  it('colors final district calculation green with separate official chips', async () => {
    loadStateDeputy.and.callFake(async (_c, _e, _s, scope: string) => {
      const data = stateDeputyFixture(scope); data.tf = 's'; data.and = 'f'; data.esae = 'n';
      data.carg[0]!.agr[0]!.par[0]!.cand[0]!.st = 'Eleito por QP';
      return parseStateDeputyEA20(data, '43', 1, scope);
    });
    const fixture = await setup('/deputado-estadual/uf/df'); const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.candidates mat-card.elected').length).toBe(3);
    expect(element.querySelector('mat-chip.confirmed-status')?.textContent).toContain('ELEITO');
    expect(element.querySelector('mat-chip.official-status')?.textContent).toContain('TSE: Eleito por QP');
  });
  it('uses statewide senator leaders for municipal backgrounds and reserves green for official elected status', async () => {
    loadSenator.and.callFake(async (_c, _e, _s, scope: string) => {
      const local = parseSenatorEA20(senatorFixture(scope), '43', 1, scope);
      const state = parseSenatorEA20(senatorFixture(scope.split('/')[0]), '43', 1, scope.split('/')[0]);
      state.candidates.push({ ...state.candidates[1]!, id: '999', name: 'Líder somente municipal', votes: 1 });
      local.candidates.push({ ...state.candidates[2]!, votes: 1000 });
      local.candidates.sort((a, b) => b.votes! - a.votes!);
      local.stateResult = state; return local;
    });
    const fixture = await setup('/senador/uf/al/municipio/00001'); const element = fixture.nativeElement as HTMLElement;
    const cards = Array.from(element.querySelectorAll('.candidates mat-card'));
    expect(cards[0]?.textContent).toContain('Líder somente municipal'); expect(cards[0]?.classList.contains('provisional')).toBeFalse();
    expect(element.querySelectorAll('.candidates mat-card.provisional').length).toBe(2);
    const provisionalStyle = getComputedStyle(element.querySelector('.candidates mat-card.provisional')!);
    expect(provisionalStyle.borderTopColor).toBe('rgb(134, 239, 172)');
    expect(provisionalStyle.boxShadow).toContain('rgb(134, 239, 172)');
    expect(provisionalStyle.boxShadow).toContain('18px 4px');
    for (const chip of Array.from(element.querySelectorAll('.candidates mat-card.provisional mat-chip'))) {
      expect(getComputedStyle(chip).backgroundColor).toBe('rgb(134, 239, 172)');
    }
    expect(element.querySelector('.candidates mat-card.elected')).toBeNull();
    loadSenator.and.callFake(async (_c, _e, _s, scope: string) => {
      const data = senatorFixture(scope); data.and = 'f';
      data.carg[0]!.agr[0]!.par[0]!.cand[0]!.st = 'Eleito';
      data.carg[0]!.agr[0]!.par[0]!.cand[1]!.st = 'Não eleito';
      return parseSenatorEA20(data, '43', 1, scope);
    });
    await TestBed.inject(Router).navigateByUrl('/senador/uf/al'); await settle(fixture);
    expect(element.querySelectorAll('.candidates mat-card.elected').length).toBe(1);
    expect(element.querySelectorAll('.candidates mat-card.not-elected').length).toBe(1);
    expect(element.querySelector('.candidates mat-card.provisional')).toBeNull();
    expect(element.querySelector('mat-chip.calculated-status')).toBeNull();
  });
  it('renders deputy municipality votes with statewide allocation and official and provisional status chips', async () => {
    const fixture = await setup('/deputado-federal/uf/al/municipio/00001'); const element = fixture.nativeElement as HTMLElement;
    expect(loadFederalDeputy.calls.mostRecent().args[3]).toBe('al/00001');
    expect(element.textContent).toContain('Distribuição de 3 vagas');
    expect(element.textContent).toContain('Os votos abaixo são do município');
    expect(element.querySelectorAll('mat-chip.calculated-status').length).toBe(3);
    expect(element.querySelector('mat-chip.calculated-status')?.textContent).toContain('Provisoriamente na faixa de eleição');
    expect(element.querySelectorAll('.candidates mat-card.provisional').length).toBe(3);
    expect(element.querySelector('.candidates mat-card.elected')).toBeNull();
    expect(element.querySelector('mat-chip.official-status')?.textContent).toContain('TSE: Ainda não informada');
    expect(element.querySelector('.candidates .highlight')).toBeNull();
    tab(element, 'Presidente').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(element.querySelector('mat-chip.calculated-status')).toBeNull();
    expect(element.querySelector('mat-chip.official-status')).not.toBeNull();
    tab(element, 'Dep. Federal').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/deputado-federal/uf/al/municipio/00001');
  });
  it('shows elected-by-calculation chips after the UF finishes, even if the municipal status is different', async () => {
    loadFederalDeputy.and.callFake(async (_c, _e, _s, scope: string) => {
      const result = parseFederalDeputyEA20(deputyFixture(scope), '43', 1, scope);
      const state = deputyFixture(); state.tf = 's'; state.and = 'f'; state.esae = 'n'; state.carg[0]!.agr[0]!.par[0]!.cand[0]!.st = 'Eleito por QP';
      result.stateResult = parseFederalDeputyEA20(state, '43', 1, 'al'); return result;
    });
    const fixture = await setup('/deputado-federal/uf/al/municipio/00001'); const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('mat-chip.confirmed-status').length).toBe(3);
    expect(element.querySelector('mat-chip.confirmed-status')?.textContent).toContain('ELEITO');
    expect(element.querySelectorAll('.candidates mat-card.elected').length).toBe(3);
    expect(element.querySelector('.candidates mat-card.provisional')).toBeNull();
    expect(element.textContent).toContain('TSE: Eleito por QP');
    expect(element.textContent).not.toContain('Provisoriamente na faixa');
  });
  it('renders Senator UF and municipality, returns to Governor without mixing cargos and keeps President on Brazil', async () => {
    const fixture = await setup('/senador/uf/al/municipio/00001'); const element = fixture.nativeElement as HTMLElement;
    expect(loadSenator.calls.mostRecent().args[3]).toBe('al/00001');
    expect(loadGovernor).not.toHaveBeenCalled();
    expect(element.textContent).toContain('2 vagas para Senador');
    expect(element.textContent).toContain('Primeiro suplente');
    expect(element.textContent).not.toContain('Situação: Eleito');
    expect(element.querySelector('.candidates .highlight')).toBeNull();
    const municipality = element.querySelector<HTMLSelectElement>('select')!;
    municipality.value = ''; municipality.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/senador/uf/al');
    expect(loadSenator.calls.mostRecent().args[3]).toBe('al');
    tab(element, 'Governador').click(); await settle(fixture);
    expect(loadGovernor.calls.mostRecent().args[3]).toBe('al');
    expect(element.textContent).not.toContain('2 vagas para Senador');
    tab(element, 'Presidente').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(TestBed.inject(ElectionNavigationService).stateFilter().uf).toBe('al');
  });
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
  it('keeps President on Brazil while selecting a state through the separate Material control', async () => {
    const fixture = await setup();
    const controls = await TestbedHarnessEnvironment.loader(fixture).getAllHarnesses(MatSelectHarness);
    expect(controls.length).toBe(2);
    expect(await controls[0]!.getValueText()).toBe('Brasil inteiro');
    await controls[1]!.open(); await controls[1]!.clickOptions({ text: 'AL' });
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(Router).url).toBe('/');
    expect(loadPresident).toHaveBeenCalledTimes(1);
    for (const name of ['Governador', 'Senador', 'Dep. Federal', 'Dep. Estadual']) expect(tab(element, name).getAttribute('aria-disabled')).not.toBe('true');
    tab(element, 'Governador').click();
    await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/governador/uf/al');
    expect(loadGovernor.calls.mostRecent().args[3]).toBe('al');
    tab(element, 'Presidente').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(loadPresident.calls.mostRecent().args[3]).toBe('br');
  });
  it('keeps different UFs and municipalities for President and state tabs', async () => {
    const fixture = await setup('/uf/al/municipio/00001'); const element = fixture.nativeElement as HTMLElement;
    const navigation = TestBed.inject(ElectionNavigationService);
    expect(tab(element, 'Governador').getAttribute('aria-disabled')).toBe('true');
    navigation.selectStateUf('df'); await settle(fixture);
    tab(element, 'Governador').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/governador/uf/df');
    await TestBed.inject(Router).navigateByUrl('/governador/uf/df/municipio/97012'); await settle(fixture);
    expect(loadGovernor.calls.mostRecent().args[3]).toBe('df/97012');
    const count = loadGovernor.calls.count() + loadPresident.calls.count();
    tab(element, 'Dep. Estadual').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/deputado-estadual/uf/df/municipio/97012');
    expect(element.textContent).toContain('Deputado Distrital');
    expect(element.textContent).not.toContain('Em implementação');
    expect(loadStateDeputy.calls.mostRecent().args[3]).toBe('df/97012');
    expect(loadGovernor.calls.count() + loadPresident.calls.count()).toBe(count);
    tab(element, 'Presidente').click(); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/uf/al/municipio/00001');
    expect(navigation.stateFilter()).toEqual({ uf: 'df', municipality: '97012' });
  });
  it('restores the saved federal municipality after clearing the state filter and disables state tabs', async () => {
    const fixture = await setup('/uf/al/municipio/00001');
    const navigation = TestBed.inject(ElectionNavigationService);
    navigation.selectStateUf('df'); await settle(fixture);
    tab(fixture.nativeElement, 'Governador').click(); await settle(fixture);
    navigation.selectStateUf('');
    await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/uf/al/municipio/00001');
    expect(loadPresident.calls.mostRecent().args[3]).toBe('al/00001');
    expect(tab(fixture.nativeElement, 'Governador').getAttribute('aria-disabled')).toBe('true');
  });
  it('loads a direct state deputy municipal route and switches to the correct DF office when changing UF', async () => {
    const fixture = await setup('/deputado-estadual/uf/al/municipio/00001');
    const navigation = TestBed.inject(ElectionNavigationService);
    expect(navigation.hasStateUf()).toBeTrue();
    expect(navigation.states()).toEqual(['al', 'df']);
    expect(loadPresident).not.toHaveBeenCalled(); expect(loadGovernor).not.toHaveBeenCalled();
    navigation.selectStateUf('df'); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/deputado-estadual/uf/df');
    expect(navigation.municipality()).toBe('');
    expect(loadStateDeputy.calls.mostRecent().args[3]).toBe('df');
    expect(fixture.nativeElement.querySelector('h2').textContent).toBe('Deputado Distrital');
  });
  it('changes the inactive federal filter without reloading Governor and clears only the changed group municipality', async () => {
    const fixture = await setup('/governador/uf/df/municipio/97012');
    const navigation = TestBed.inject(ElectionNavigationService);
    const count = loadGovernor.calls.count();
    navigation.selectFederalUf('al'); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/governador/uf/df/municipio/97012');
    expect(loadGovernor).toHaveBeenCalledTimes(count); expect(loadPresident).not.toHaveBeenCalled();
    expect(navigation.stateFilter()).toEqual({ uf: 'df', municipality: '97012' });
    navigation.selectStateUf('al'); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/governador/uf/al');
    expect(navigation.federalFilter()).toEqual({ uf: 'al', municipality: '' });
  });
  it('clears the federal UF without disabling state tabs or losing the state municipality', async () => {
    const fixture = await setup('/uf/al/municipio/00001');
    const navigation = TestBed.inject(ElectionNavigationService);
    navigation.selectStateUf('df'); await settle(fixture);
    tab(fixture.nativeElement, 'Governador').click(); await settle(fixture);
    await TestBed.inject(Router).navigateByUrl('/governador/uf/df/municipio/97012'); await settle(fixture);
    tab(fixture.nativeElement, 'Presidente').click(); await settle(fixture);
    navigation.selectFederalUf(''); await settle(fixture);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(navigation.hasStateUf()).toBeTrue();
    expect(navigation.stateFilter()).toEqual({ uf: 'df', municipality: '97012' });
    expect(tab(fixture.nativeElement, 'Governador').getAttribute('aria-disabled')).not.toBe('true');
  });
});
