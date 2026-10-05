import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { ELECTION_DATA_PROVIDER } from './core/api/election-data-provider';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter(routes),
        { provide: ELECTION_DATA_PROVIDER, useValue: { loadConfiguration: async () => ({
          generatedDate: '04/10/2026', generatedTime: '17:00:00', generationId: '1',
          phase: 'o', directories: [], elections: []
        }) } }
      ]
    }).compileComponents();
  });

  it('renders discovery without claiming live results', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand img')?.getAttribute('alt')).toBe('ApuraBrasil');
    expect(element.textContent).toContain('Nenhuma eleição geral');
    expect(element.textContent).toContain('Nenhum resultado eleitoral foi recebido para Presidente');
    expect(element.textContent).not.toContain('AO VIVO');
  });
});
