import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { ElectionNavigationService } from '../../core/services/election-navigation.service';
import { ElectionPollingService } from '../../core/services/election-polling.service';
import { PresidentStore } from '../../core/state/president.store';

@Component({
  selector: 'app-pending-office',
  template: `<section aria-labelledby="pending-title"><h2 id="pending-title">{{ heading() }}</h2><p>Em implementação</p><p>UF: {{ navigation.uf().toUpperCase() }} @if (navigation.municipality()) { · Município: {{ navigation.municipality() }} }</p></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PendingOfficeComponent implements OnInit {
  readonly navigation = inject(ElectionNavigationService);
  private readonly polling = inject(ElectionPollingService);
  private readonly results = inject(PresidentStore);
  readonly heading = computed(() => this.navigation.tabs.find(tab => tab.id === this.navigation.office())?.label);
  ngOnInit(): void {
    this.polling.stop(); this.results.result.set(null); this.results.error.set(null);
  }
}
