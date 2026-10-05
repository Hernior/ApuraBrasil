import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-share-result-dialog',
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Compartilhar resultado</h2>
    <mat-dialog-content>
      <p>Resumo dos últimos dados recebidos ao abrir esta janela, formatado para WhatsApp.</p>
      <label for="share-summary">Prévia da mensagem</label>
      <textarea #preview id="share-summary" readonly [value]="text"></textarea>
      <p role="status" aria-live="polite">{{ message() }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Fechar</button>
      <button matButton="outlined" (click)="copy()">Copiar texto</button>
      <a matButton="filled" [href]="whatsappUrl" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
    </mat-dialog-actions>
  `,
  styles: `
    textarea { box-sizing: border-box; width: 100%; min-height: 18rem; margin-top: .5rem; padding: .75rem; font: inherit; line-height: 1.5; resize: vertical; }
    mat-dialog-actions { gap: .5rem; flex-wrap: wrap; }
  `
})
export class ShareResultDialogComponent {
  readonly text = inject<string>(MAT_DIALOG_DATA);
  readonly whatsappUrl = `https://wa.me/?text=${encodeURIComponent(this.text)}`;
  readonly message = signal('');
  private readonly clipboard = inject(Clipboard);
  private readonly preview = viewChild<ElementRef<HTMLTextAreaElement>>('preview');

  copy(): void {
    if (this.clipboard.copy(this.text)) this.message.set('Texto copiado!');
    else {
      this.preview()?.nativeElement.focus();
      this.preview()?.nativeElement.select();
      this.message.set('Não foi possível copiar automaticamente. O texto foi selecionado para você copiar.');
    }
  }
}
