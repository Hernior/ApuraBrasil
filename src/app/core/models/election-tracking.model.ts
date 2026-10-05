export interface ElectionTracking {
  nationalTracking?: ElectionTracking;
  stateTracking?: ElectionTracking;
  manualNotice?: string;
  electionId: string;
  availableStates: string[];
  round: 1 | 2;
  phase: 'o' | 's';
  generationId: string;
  signature: string;
  national: {
    date: string | null;
    time: string | null;
    processedSections: number | null;
    progress: 'n' | 'p' | 'f';
  };
}
