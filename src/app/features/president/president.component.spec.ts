import { parseEA14 } from '../../core/api/ea14-parser';
import { trackingFixture } from '../../core/api/president-test.fixture';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ELECTION_DATA_PROVIDER } from '../../core/api/election-data-provider';
import { parsePresidentEA20 } from '../../core/api/ea20-parser';
import { presidentFixture, testConfiguration } from '../../core/api/president-test.fixture';
import { ElectionStore } from '../../core/state/election.store';
import { PresidentComponent } from './president.component';

describe('PresidentComponent', () => {
  let loadPresident: jasmine.Spy;
  beforeEach(() => {
    loadPresident = jasmine.createSpy().and.resolveTo(parsePresidentEA20(presidentFixture(), '42', 1));
    TestBed.configureTestingModule({
      imports: [PresidentComponent],
      providers: [provideNoopAnimations(), { provide: ELECTION_DATA_PROVIDER, useValue: { loadPresident, loadTracking: async () => parseEA14(trackingFixture(), '42', 1) } }]
    });
    TestBed.inject(ElectionStore).configuration.set(testConfiguration);
  });
  it('renders real result fields and loads once without a signal loop', async () => {
    const fixture = TestBed.createComponent(PresidentComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Teste B');
    expect(text).toContain('2º turno');
    expect(text).not.toContain('Situação: Eleito');
    expect(text).toContain('50.00%');
    expect(loadPresident).toHaveBeenCalledTimes(1);
  });
  it('hides votes and candidate bars before disclosure is allowed', async () => {
    const data = presidentFixture(); data.dv = 'n';
    loadPresident.and.resolveTo(parsePresidentEA20(data, '42', 1));
    const fixture = TestBed.createComponent(PresidentComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('ainda não autorizou');
    expect(element.querySelector('.vote-line')).toBeNull();
    expect(element.querySelector('.metrics')).toBeNull();
  });
});
