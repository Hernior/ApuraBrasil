import { InjectionToken } from '@angular/core';
import { ElectionConfiguration } from '../models/election.model';

export interface ElectionDataProvider {
  loadConfiguration(signal: AbortSignal): Promise<ElectionConfiguration>;
}
export const ELECTION_DATA_PROVIDER = new InjectionToken<ElectionDataProvider>('ElectionDataProvider');
