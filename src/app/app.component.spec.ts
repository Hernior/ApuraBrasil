import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideNoopAnimations()]
    }).compileComponents();
  });

  it('renders the brand and a pending state without claiming live results', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')?.textContent).toContain('ApuraBrasil');
    expect(element.textContent).toContain('Integração pendente');
    expect(element.textContent).toContain('Nenhum resultado eleitoral foi recebido');
    expect(element.textContent).not.toContain('AO VIVO');
  });
});
