export interface ProportionalGroup {
  id: string;
  name: string;
  type: 'i' | 'f';
  nominalVotes: number | null;
  legendVotes: number | null;
  officialSeats: number | null;
  candidateIds: string[];
}

export interface ProportionalAllocation {
  quotient: number | null;
  final: boolean;
  unavailableReason: string | null;
  winners: { candidateId: string; method: 'qp' | 'average' }[];
  groups: { id: string; name: string; votes: number; quotient: number; seats: number; officialSeats: number | null }[];
  unfilledSeats: number;
}
