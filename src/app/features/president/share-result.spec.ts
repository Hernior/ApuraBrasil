import { Clipboard } from '@angular/cdk/clipboard';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ELECTION_DATA_PROVIDER } from '../../core/api/election-data-provider';
import { parsePresidentEA20 } from '../../core/api/ea20-parser';
import { presidentFixture, testElection } from '../../core/api/president-test.fixture';
import { ElectionResult } from '../../core/models/election-result.model';
import { ElectionStore } from '../../core/state/election.store';
import { PresidentStore } from '../../core/state/president.store';
import { PresidentComponent } from './president.component';
import { buildElectionShareSummary, ShareSummaryOptions } from './share-election-summary';
import { ShareResultDialogComponent } from './share-result-dialog.component';

const result = () => parsePresidentEA20(presidentFixture(), '42', 1, 'br');
const options = (value = result()): ShareSummaryOptions => ({ result: value, officeName: 'Presidente', location: 'Brasil', url: 'https://example.org/ApuraBrasil/#/', officialStatus: c => c.status ?? 'Ainda não informada pelo TSE', calculatedStatus: () => '' });

describe('WhatsApp election summary', () => {
  it('formats the latest snapshot and sorts at most five candidates without mutating the result', () => {
    const value = result();
    value.candidates = Array.from({ length: 7 }, (_, i) => ({ ...value.candidates[0]!, id: `${i}`, name: `Pessoa ${i}`, votes: i * 1000, percentage: i * 10 }));
    const text = buildElectionShareSummary(options(value));
    expect(text).toContain('*Cargo:* Presidente'); expect(text).toContain('*Turno:* 1º');
    expect(text).toContain('*Seções totalizadas:* 50,00%'); expect(text).toContain('04/10/2026 às 17:00:00');
    expect(text).toContain('1. *Pessoa 6*'); expect(text).toContain('6.000 votos'); expect(text).toContain('5. *Pessoa 2*');
    expect(text).not.toContain('Pessoa 1'); expect(text).not.toContain('Pessoa 0');
    expect(value.candidates[0]!.id).toBe('0'); expect(text).toContain(options().url);
  });
  it('does not share hidden voting or candidate classifications before TSE disclosure', () => {
    const value = result(); value.disclosureAllowed = false;
    const status = jasmine.createSpy().and.returnValue('Eleito');
    const text = buildElectionShareSummary({ ...options(value), officialStatus: status, calculatedStatus: status });
    expect(text).toContain('ainda não autorizou'); expect(text).not.toContain(value.candidates[0]!.name);
    expect(status).not.toHaveBeenCalled();
  });
  it('separates UF official status and provisional calculation from local voting', () => {
    const value = result(); value.officeCode = '5'; value.scopeCode = 'al/00001'; value.stateResult = { ...result(), scopeCode: 'al' };
    const text = buildElectionShareSummary({ ...options(value), officeName: 'Senador', location: 'Cidade teste · AL', officialStatus: () => 'Não eleito', calculatedStatus: () => 'Provisoriamente na faixa de eleição da UF' });
    expect(text).toContain('Votos municipais'); expect(text).toContain('Arquivo estadual:');
    expect(text).toContain('Situação TSE: Não eleito'); expect(text).toContain('ApuraBrasil: Provisoriamente');
  });
  it('retains simulated, failed-update and unavailable percentage notices', () => {
    const value = result(); value.phase = 's'; value.processedPercentage = null;
    const text = buildElectionShareSummary({ ...options(value), notice: 'Últimos dados recebidos: a atualização falhou.' });
    expect(text).toContain('SIMULADO'); expect(text).toContain('a atualização falhou'); expect(text).toContain('*Seções totalizadas:* —');
  });
});

describe('Sharing modal', () => {
  const text = '*ApuraBrasil*\nCidade · AL & 50,00%\nhttps://example.org/#/uf/al';
  let clipboard: jasmine.Spy;
  beforeEach(() => {
    clipboard = jasmine.createSpy().and.returnValue(true);
    TestBed.configureTestingModule({ imports: [ShareResultDialogComponent], providers: [provideNoopAnimations(),
      { provide: MAT_DIALOG_DATA, useValue: text }, { provide: MatDialogRef, useValue: { close: jasmine.createSpy() } },
      { provide: Clipboard, useValue: { copy: clipboard } }] });
  });
  it('previews, copies and opens the exact same formatted text in WhatsApp compose', () => {
    const fixture = TestBed.createComponent(ShareResultDialogComponent); fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('textarea')!.value).toBe(text);
    Array.from(element.querySelectorAll('button')).find(b => b.textContent?.includes('Copiar'))!.click(); fixture.detectChanges();
    expect(clipboard).toHaveBeenCalledOnceWith(text); expect(element.textContent).toContain('Texto copiado!');
    const link = element.querySelector('a')!;
    expect(new URL(link.href).searchParams.get('text')).toBe(text); expect(link.target).toBe('_blank'); expect(link.rel).toContain('noopener');
  });
  it('selects the preview and gives manual copy instructions when copying fails', () => {
    clipboard.and.returnValue(false);
    const fixture = TestBed.createComponent(ShareResultDialogComponent); fixture.detectChanges();
    const preview: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    spyOn(preview, 'select'); fixture.componentInstance.copy(); fixture.detectChanges();
    expect(preview.select).toHaveBeenCalled(); expect(fixture.nativeElement.textContent).toContain('Não foi possível copiar automaticamente');
  });
  it('opens and closes an accessible Material modal with the message preview', async () => {
    const dialog = TestBed.inject(MatDialog);
    const ref = dialog.open(ShareResultDialogComponent, { data: text });
    TestBed.inject(ApplicationRef).tick();
    await ref.afterOpened().toPromise();
    TestBed.inject(ApplicationRef).tick();
    const element = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(element).not.toBeNull();
    expect(element.querySelector('textarea')!.value).toBe(text);
    expect(element.querySelector('textarea')!.readOnly).toBeTrue();
    const title = document.getElementById(element.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toContain('Compartilhar resultado');
    const closed = ref.afterClosed().toPromise();
    Array.from(element.querySelectorAll('button')).find(b => b.textContent?.includes('Fechar'))!.click();
    await closed; expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('Sharing the active election tab', () => {
  const params = new BehaviorSubject(convertToParamMap({}));
  const data = new BehaviorSubject<Record<string, string>>({});
  let open: jasmine.Spy;
  beforeEach(() => {
    params.next(convertToParamMap({})); data.next({}); open = jasmine.createSpy();
    TestBed.configureTestingModule({ imports: [PresidentComponent], providers: [provideNoopAnimations(),
      { provide: ELECTION_DATA_PROVIDER, useValue: {} },
      { provide: ActivatedRoute, useValue: { paramMap: params, data } },
      { provide: Router, useValue: { url: '/senador/uf/al/municipio/00001' } },
      { provide: MatDialog, useValue: { open } },
      { provide: ElectionStore, useValue: { configuration: signal(null), loading: signal(false), elections: signal([
        testElection, { ...testElection, id: '43', kind: 'state', scopes: [{ code: 'br', offices: ['3', '5', '6', '7', '8'].map(code => ({ code })) }] }
      ]) } }] });
  });
  it('disables sharing with no result and rejects a result from a previous tab or scope', () => {
    const fixture = TestBed.createComponent(PresidentComponent); fixture.detectChanges();
    const button = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(b => b.textContent === 'Compartilhar')!;
    expect(button.disabled).toBeTrue();
    TestBed.inject(PresidentStore).result.set(result()); fixture.detectChanges(); expect(button.disabled).toBeFalse();
    params.next(convertToParamMap({ uf: 'al' })); fixture.detectChanges(); expect(button.disabled).toBeTrue();
    fixture.componentInstance.share(); expect(open).not.toHaveBeenCalled();
  });
  it('shares each active cargo, including Distrital, with the correct geography', () => {
    const fixture = TestBed.createComponent(PresidentComponent); fixture.detectChanges();
    const cases: [string, ElectionResult['officeCode'], string, string][] = [
      ['', '1', 'br', 'Presidente'], ['governor', '3', 'al', 'Governador'], ['senator', '5', 'al', 'Senador'],
      ['federal-deputy', '6', 'al', 'Deputado Federal'], ['state-deputy', '7', 'al', 'Deputado Estadual'], ['state-deputy', '8', 'df', 'Deputado Distrital']
    ];
    for (const [office, code, scope, name] of cases) {
      data.next({ office }); params.next(convertToParamMap(scope === 'br' ? {} : { uf: scope }));
      TestBed.inject(PresidentStore).result.set({ ...result(), officeCode: code, electionId: code === '1' ? '42' : '43', scopeCode: scope });
      fixture.detectChanges(); fixture.componentInstance.share();
      expect(open.calls.mostRecent().args[1].data).toContain(`*Cargo:* ${name}`);
      expect(open.calls.mostRecent().args[1].data).toContain(scope === 'br' ? '*Local:* Brasil' : `*Local:* Toda a UF · ${scope.toUpperCase()}`);
    }
    expect(open.calls.count()).toBe(6);
  });
  it('keeps UF statuses for a municipal senator and freezes the preview while polling changes', () => {
    data.next({ office: 'senator' }); params.next(convertToParamMap({ uf: 'al', codigo: '00001' }));
    const fixture = TestBed.createComponent(PresidentComponent); fixture.detectChanges();
    const state = { ...result(), electionId: '43', officeCode: '5' as const, scopeCode: 'al', seats: 2 };
    state.candidates = state.candidates.map(c => ({ ...c, status: 'Eleito' }));
    const local: ElectionResult = { ...state, scopeCode: 'al/00001', stateResult: state, candidates: state.candidates.map(c => ({ ...c, status: 'Não eleito' })) };
    fixture.componentInstance.municipalities.set([{ uf: 'al', code: '00001', ibgeCode: '2700001', name: 'Cidade teste', capital: false }]);
    TestBed.inject(PresidentStore).result.set(local); fixture.detectChanges(); fixture.componentInstance.share();
    const snapshot: string = open.calls.mostRecent().args[1].data;
    expect(snapshot).toContain('*Local:* Cidade teste · AL'); expect(snapshot).toContain('Situação TSE: Eleito'); expect(snapshot).not.toContain('Situação TSE: Não eleito');
    expect(snapshot).toContain('#/senador/uf/al/municipio/00001');
    TestBed.inject(PresidentStore).result.set({ ...local, generatedTime: '18:00:00' });
    expect(open.calls.mostRecent().args[1].data).toBe(snapshot); expect(snapshot).not.toContain('18:00:00');
  });
  it('labels provisional and final deputy calculations separately from official TSE status', () => {
    data.next({ office: 'federal-deputy' }); params.next(convertToParamMap({ uf: 'al' }));
    const fixture = TestBed.createComponent(PresidentComponent); fixture.detectChanges();
    const value: ElectionResult = { ...result(), electionId: '43', scopeCode: 'al', officeCode: '6',
      allocation: { quotient: 1, final: false, unavailableReason: null, winners: [{ candidateId: result().candidates[0]!.id, method: 'qp' }], groups: [], unfilledSeats: 0 } };
    TestBed.inject(PresidentStore).result.set(value); fixture.detectChanges(); fixture.componentInstance.share();
    expect(open.calls.mostRecent().args[1].data).toContain('ApuraBrasil: Provisoriamente na faixa de eleição da UF');
    expect(open.calls.mostRecent().args[1].data).not.toContain('Eleito pelo cálculo');
    TestBed.inject(PresidentStore).result.set({ ...value, allocation: { ...value.allocation!, final: true } });
    fixture.detectChanges(); fixture.componentInstance.share();
    expect(open.calls.mostRecent().args[1].data).toContain('ApuraBrasil: Eleito pelo cálculo de vagas da UF');
    expect(open.calls.mostRecent().args[1].data).toContain('Situação TSE:');
  });
});
