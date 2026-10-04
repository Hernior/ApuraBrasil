import { Candidate } from './candidate.model';

export interface ElectionResult {
  electionId: string;
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
