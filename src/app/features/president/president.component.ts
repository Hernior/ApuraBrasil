import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ElectionStore } from '../../core/state/election.store';
import { PresidentStore } from '../../core/state/president.store';

@Component({
  selector: 'app-president',
  imports: [DecimalPipe, MatButtonModule, MatCardModule],
  templateUrl: './president.component.html',
  styleUrl: './president.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PresidentComponent implements OnDestroy {
  readonly elections = inject(ElectionStore);
  readonly president = inject(PresidentStore);
  readonly selectedId = signal<string | null>(null);
  readonly failedPhotos = signal<Set<string>>(new Set());
  readonly available = computed(() => this.elections.elections().filter(e =>
    e.kind === 'federal' && e.scopes.some(s => s.code === 'br' && s.offices.some(o => Number(o.code) === 1))));
  readonly selected = computed(() => this.available().find(e => e.id === this.selectedId()) ?? this.available()[0] ?? null);

  constructor() {
    effect(() => {
      const config = this.elections.configuration();
      const election = this.selected();
      if (config && election) {
        untracked(() => { void this.president.load(config, election); });
      } else if (config) {
        untracked(() => { this.president.cancel(); this.president.result.set(null); });
      }
    });
  }
  selectElection(event: Event): void {
    this.selectedId.set((event.target as HTMLSelectElement).value);
  }
  refresh(): void {
    const config = this.elections.configuration();
    const election = this.selected();
    if (config && election) {
        untracked(() => { void this.president.load(config, election); });
      } else if (config) {
        untracked(() => { this.president.cancel(); this.president.result.set(null); });
      }
  }
  photoFailed(id: string): void {
    this.failedPhotos.update(ids => new Set([...ids, id]));
  }
  ngOnDestroy(): void { this.president.cancel(); }
}
