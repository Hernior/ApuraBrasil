import { Candidate } from './candidate.model';
import { ProportionalAllocation, ProportionalGroup } from './proportional.model';

export interface ElectionResult {
  mathematicallyDefined?: 'e' | 's' | 'n' | null;
  remainingElectors?: number | null;
  nationalResult?: ElectionResult;
  officeCode?: '1' | '3' | '5' | '6' | '7' | '8';
  finalTotalization?: boolean;
  noWinners?: boolean | null;
  officialQuotient?: number | null;
  proportionalGroups?: ProportionalGroup[];
  allocation?: ProportionalAllocation;
  stateResult?: ElectionResult;
  seats?: number | null;
  electionId: string;
  scopeCode: string;
  round: 1 | 2;
  phase: 'o' | 's';
  generationId: string;
  generatedDate: string;
  generatedTime: string;
  totalizationDate: string | null;
  totalizationTime: string | null;
  disclosureAllowed: boolean;
  progress: 'n' | 'p' | 'f';
  processedPercentage: number | null;
  processedSections: number | null;
  totalSections: number | null;
  validVotes: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
  turnout: number | null;
  turnoutPercentage: number | null;
  abstention: number | null;
  abstentionPercentage: number | null;
  candidates: Candidate[];
}
