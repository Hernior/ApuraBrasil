import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { ELECTION_DATA_PROVIDER } from '../../core/api/election-data-provider';
import { parseEA14 } from '../../core/api/ea14-parser';
import { parseGovernorEA20, parsePresidentEA20 } from '../../core/api/ea20-parser';
import { governorConfiguration, governorFixture, governorTrackingFixture } from '../../core/api/governor-test.fixture';
import { presidentFixture, trackingFixture } from '../../core/api/president-test.fixture';
import { ElectionStore } from '../../core/state/election.store';
import { ElectionPollingService } from '../../core/services/election-polling.service';
import { PresidentComponent } from './president.component';

describe('Governor routes', () => {
  let loadGovernor: jasmine.Spy, loadPresident: jasmine.Spy, loadTracking: jasmine.Spy;
  beforeEach(() => {
    loadGovernor = jasmine.createSpy().and.callFake(async (_c, _e, _s, scope) => parseGovernorEA20(governorFixture(scope), '43', 1, scope));
    loadPresident = jasmine.createSpy().and.resolveTo(parsePresidentEA20(presidentFixture(), '42', 1));
    loadTracking = jasmine.createSpy().and.callFake(async (_c, e, _s, scope) => parseEA14(e.kind === 'state' ? governorTrackingFixture() : trackingFixture(), e.id, 1, scope.split('/')[0]));
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideNoopAnimations(), { provide: ELECTION_DATA_PROVIDER, useValue: {
      loadGovernor, loadPresident, loadTracking, loadMunicipalities: async () => [
        { uf: 'al', code: '00001', ibgeCode: '2700001', name: 'Cidade teste', capital: true },
        { uf: 'df', code: '97012', ibgeCode: '5300108', name: 'Brasília', capital: true }
      ]
    } }] });
    TestBed.inject(ElectionStore).configuration.set(governorConfiguration);
  });
  afterEach(() => TestBed.inject(ElectionPollingService).stop());
  it('ignores a delayed Governor response after switching to President', async () => {
    let complete!: (value: ReturnType<typeof parseGovernorEA20>) => void;
    loadGovernor.and.returnValue(new Promise(resolve => { complete = resolve; }));
    const harness = await RouterTestingHarness.create();
    const governor = await harness.navigateByUrl('/governador/uf/al', PresidentComponent);
    harness.detectChanges();
    for (let i = 0; i < 10 && !loadGovernor.calls.count(); i++) await Promise.resolve();
    expect(loadGovernor).toHaveBeenCalled();
    const president = await harness.navigateByUrl('/', PresidentComponent);
    complete(parseGovernorEA20(governorFixture(), '43', 1, 'al'));
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(president.president.result()?.officeCode).toBe('1');
    expect(president.president.result()?.electionId).toBe('42');
    expect(governor.president.result()?.scopeCode).toBe('br');
  });
  it('offers UF selection without requesting a national Governor result', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/governador', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(component.availableStates()).toEqual(['al', 'df']);
    expect(loadGovernor).not.toHaveBeenCalled(); expect(loadTracking).not.toHaveBeenCalled();
    expect(harness.routeNativeElement?.textContent).toContain('Escolha uma UF');
  });
  it('opens a direct UF, switches to municipality and returns to President without mixing results', async () => {
    const harness = await RouterTestingHarness.create();
    const state = await harness.navigateByUrl('/governador/uf/al', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(state.president.result()?.officeCode).toBe('3');
    expect(loadPresident).not.toHaveBeenCalled();
    const city = await harness.navigateByUrl('/governador/uf/al/municipio/00001', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(city.president.result()?.scopeCode).toBe('al/00001');
    expect(harness.routeNativeElement?.textContent).toContain('Cidade teste · AL');
    const president = await harness.navigateByUrl('/', PresidentComponent);
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(president.president.result()?.officeCode).toBe('1');
    expect(president.president.result()?.scopeCode).toBe('br');
  });
  it('supports the DF and rejects unknown municipalities before tracking and results', async () => {
    const harness = await RouterTestingHarness.create();
    const df = await harness.navigateByUrl('/governador/uf/df', PresidentComponent);
    await harness.fixture.whenStable();
    expect(df.president.result()?.scopeCode).toBe('df');
    loadGovernor.calls.reset(); loadTracking.calls.reset();
    const invalid = await harness.navigateByUrl('/governador/uf/al/municipio/00002', PresidentComponent);
    await harness.fixture.whenStable();
    expect(invalid.municipalitiesError()).toContain('Município não disponível');
    expect(loadGovernor).not.toHaveBeenCalled(); expect(loadTracking).not.toHaveBeenCalled();
  });
});
