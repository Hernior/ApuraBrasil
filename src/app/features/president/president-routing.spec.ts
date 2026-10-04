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

describe('President state routes', () => {
  let loadPresident: jasmine.Spy;
  let loadTracking: jasmine.Spy;
  beforeEach(() => {
    loadTracking = jasmine.createSpy().and.callFake((_c, _e, _signal, scope: string) =>
      Promise.resolve(parseEA14(trackingFixture(), '42', 1, scope)));
    loadPresident = jasmine.createSpy().and.callFake((_c, _e, _signal, scope: string) =>
      Promise.resolve(parsePresidentEA20({ ...presidentFixture(), tpabr: scope === 'br' ? 'br' : 'uf', cdabr: scope }, '42', 1, scope)));
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideNoopAnimations(), {
        provide: ELECTION_DATA_PROVIDER, useValue: { loadTracking, loadPresident }
      }]
    });
    TestBed.inject(ElectionStore).configuration.set(testConfiguration);
  });
  afterEach(() => TestBed.inject(ElectionPollingService).stop());
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
