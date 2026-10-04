import { PresidentComponent } from './features/president/president.component';
import { PresidentStore } from './core/state/president.store';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ElectionStore } from './core/state/election.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, PresidentComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  readonly title = signal('ApuraBrasil');
  readonly elections = inject(ElectionStore);
  readonly president = inject(PresidentStore);

  ngOnInit(): void { void this.elections.load(); }
  ngOnDestroy(): void { this.elections.cancel(); }
}
