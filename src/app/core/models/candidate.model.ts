export interface Candidate {
  elected?: boolean | null;
  birthDate?: string | null;
  partyVoteDestination?: string | null;
  substitutes?: { type: 's1' | 's2'; name: string; party: string }[];
  id: string;
  number: string;
  name: string;
  party: string;
  federation: string | null;
  status: string | null;
  voteDestination: string | null;
  votes: number | null;
  percentage: number | null;
  sequence: number;
  photoUrl: string | null;
}
