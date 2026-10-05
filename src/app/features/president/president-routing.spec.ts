import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { routes } from '../../app.routes';
import { ELECTION_DATA_PROVIDER } from '../../core/api/election-data-provider';
import { parseEA14 } from '../../core/api/ea14-parser';
import { parsePresidentEA20 } from '../../core/api/ea20-parser';
import { presidentFixture, trackingFixture, testConfiguration } from '../../core/api/president-test.fixture';
import { ElectionStore } from '../../core/state/election.store';
import { ElectionPollingService } from '../../core/services/election-polling.service';
import { PresidentComponent } from './president.component';
import { TseRequestError } from '../../core/api/tse-request-error';

describe('President state routes', () => {
  let loadPresident: jasmine.Spy;
  let loadTracking: jasmine.Spy;
  let loadMunicipalities: jasmine.Spy;
  beforeEach(() => {
    loadMunicipalities = jasmine.createSpy().and.resolveTo([{ uf: 'al', code: '00001', ibgeCode: '2700001', name: 'Cidade teste', capital: true }]);
    loadTracking = jasmine.createSpy().and.callFake((_c, _e, _signal, scope: string) =>
      Promise.resolve(parseEA14(trackingFixture(), '42', 1, scope.split('/')[0])));
    loadPresident = jasmine.createSpy().and.callFake((_c, _e, _signal, scope: string) =>
      Promise.resolve(parsePresidentEA20({ ...presidentFixture(), tpabr: scope.includes('/') ? 'mu' : scope === 'br' ? 'br' : 'uf', cdabr: scope.split('/')[1] ?? scope }, '42', 1, scope)));
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideNoopAnimations(), {
        provide: ELECTION_DATA_PROVIDER, useValue: { loadTracking, loadPresident, loadMunicipalities }
      }]
    });
    TestBed.inject(ElectionStore).configuration.set(testConfiguration);
  });
  afterEach(() => TestBed.inject(ElectionPollingService).stop());
  it('does not bypass a metadata 429 cooldown with manual refresh or route changes', async () => {
    loadMunicipalities.and.rejectWith(new TseRequestError(429, 'limited', 700000));
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/uf/al/municipio/00001', PresidentComponent);
    await harness.fixture.whenStable();
    component.refresh(); await harness.fixture.whenStable();
    await harness.navigateByUrl('/uf/al/municipio/00002', PresidentComponent);
    await harness.fixture.whenStable();
    expect(loadMunicipalities).toHaveBeenCalledTimes(1);
    expect(loadPresident).not.toHaveBeenCalled();
  });
  it('ignores a delayed EA12 response after navigating to Brazil', async () => {
    let complete!: (value: unknown[]) => void;
    loadMunicipalities.and.returnValue(new Promise(resolve => { complete = resolve; }));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/uf/al/municipio/00001', PresidentComponent);
    const home = await harness.navigateByUrl('/', PresidentComponent);
    complete([{ uf: 'al', code: '00001', ibgeCode: '2700001', name: 'Cidade teste', capital: true }]);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(home.president.result()?.scopeCode).toBe('br');
    expect(loadPresident.calls.allArgs().every(args => args[3] === 'br')).toBeTrue();
  });
  it('opens a direct municipal URL and returns to the UF without retaining municipal results', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/uf/al/municipio/00001', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(component.president.result()?.scopeCode).toBe('al/00001');
    expect(harness.routeNativeElement?.textContent).toContain('Cidade teste · AL');
    expect(loadPresident.calls.mostRecent().args[3]).toBe('al/00001');
    const state = await harness.navigateByUrl('/uf/al', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(state.president.result()?.scopeCode).toBe('al');
  });
  it('rejects a municipality absent from EA12 before tracking or result requests', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/uf/al/municipio/00002', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(component.municipalitiesError()).toContain('Município não disponível');
    expect(loadTracking).not.toHaveBeenCalled();
    expect(loadPresident).not.toHaveBeenCalled();
  });
  it('opens a direct UF URL and switches back to Brazil without retaining the state result', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/uf/al', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(component.scope()).toBe('al');
    expect(component.president.result()?.scopeCode).toBe('al');
    expect(loadPresident.calls.mostRecent().args[3]).toBe('al');
    expect(harness.routeNativeElement?.textContent).toContain('UF · AL');
    const home = await harness.navigateByUrl('/', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(home.president.result()?.scopeCode).toBe('br');
    expect(loadPresident.calls.mostRecent().args[3]).toBe('br');
  });
  it('refuses unknown UFs without requesting a guessed EA20 URL', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/uf/xx', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(loadPresident).not.toHaveBeenCalled();
    expect(component.president.result()).toBeNull();
    expect(component.polling.message()).toContain('UF não disponível');
  });
});
