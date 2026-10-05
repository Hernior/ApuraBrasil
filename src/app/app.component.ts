import { RouterOutlet, RouterLink } from '@angular/router';
import { PresidentStore } from './core/state/president.store';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ElectionStore } from './core/state/election.store';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ElectionNavigationService } from './core/services/election-navigation.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatButtonModule, MatTabsModule, MatFormFieldModule, MatSelectModule, RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  readonly title = signal('ApuraBrasil');
  readonly elections = inject(ElectionStore);
  readonly president = inject(PresidentStore);
  readonly navigation = inject(ElectionNavigationService);

  ngOnInit(): void { void this.elections.load(); }
  ngOnDestroy(): void { this.elections.cancel(); }
}
