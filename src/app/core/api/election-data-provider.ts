import { ElectionTracking } from '../models/election-tracking.model';
import { InjectionToken } from '@angular/core';
import { Election, ElectionConfiguration } from '../models/election.model';
import { ElectionResult } from '../models/election-result.model';

export interface ElectionDataProvider {
  loadConfiguration(signal: AbortSignal): Promise<ElectionConfiguration>;
  loadTracking(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope?: string): Promise<ElectionTracking>;
  loadPresident(config: ElectionConfiguration, election: Election, signal: AbortSignal, scope?: string): Promise<ElectionResult>;
}
export const ELECTION_DATA_PROVIDER = new InjectionToken<ElectionDataProvider>('ElectionDataProvider');
