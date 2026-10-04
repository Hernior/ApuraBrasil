export interface Candidate {
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
