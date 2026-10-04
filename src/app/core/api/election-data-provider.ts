import { InjectionToken } from '@angular/core';
import { Election, ElectionConfiguration } from '../models/election.model';
import { ElectionResult } from '../models/election-result.model';

export interface ElectionDataProvider {
  loadConfiguration(signal: AbortSignal): Promise<ElectionConfiguration>;
  loadPresident(config: ElectionConfiguration, election: Election, signal: AbortSignal): Promise<ElectionResult>;
}
export const ELECTION_DATA_PROVIDER = new InjectionToken<ElectionDataProvider>('ElectionDataProvider');
