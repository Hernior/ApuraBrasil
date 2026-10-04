export interface ElectionOffice {
  code: string;
  name: string;
  type: number;
}
export interface ElectionScope {
  code: string;
  offices: ElectionOffice[];
}
export interface Election {
  id: string;
  name: string;
  type: 1 | 8;
  kind: 'federal' | 'state';
  round: 1 | 2;
  secondRoundId: string | null;
  contestId: string;
  cycle: string;
  date: string;
  scopes: ElectionScope[];
}
export interface ElectionConfiguration {
  generatedDate: string;
  generatedTime: string;
  generationId: string;
  phase: 'o' | 's';
  directories: { type: string; template: string }[];
  elections: Election[];
}
