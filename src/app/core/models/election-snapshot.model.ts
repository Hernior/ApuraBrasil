import { ElectionResult } from './election-result.model';

export interface ElectionHistoryContext {
  electionId: string;
  officeCode: NonNullable<ElectionResult['officeCode']>;
  round: 1 | 2;
  scopeCode: string;
  phase: 'o' | 's';
}

export interface ElectionSnapshot extends ElectionHistoryContext {
  id?: number;
  contextKey: string;
  observedAt: number;
  generatedDate: string;
  generatedTime: string;
  disclosureAllowed: boolean;
  processedPercentage: number | null;
  processedSections: number | null;
  totalSections: number | null;
  validVotes: number | null;
  blankVotes: number | null;
  nullVotes: number | null;
  turnout: number | null;
  abstention: number | null;
  progress: ElectionResult['progress'];
  candidates: {
    id: string;
    number: string;
    name: string;
    party: string;
    votes: number | null;
    percentage: number | null;
    status: string | null;
    voteDestination: string | null;
  }[];
}

export function historyContextKey(context: ElectionHistoryContext): string {
  return JSON.stringify([context.electionId, context.officeCode, context.round, context.scopeCode, context.phase]);
}

export function createElectionSnapshot(result: ElectionResult): ElectionSnapshot {
  const context: ElectionHistoryContext = { electionId: result.electionId, officeCode: result.officeCode ?? '1', round: result.round, scopeCode: result.scopeCode, phase: result.phase };
  return {
    ...context, contextKey: historyContextKey(context), observedAt: Date.now(),
    generatedDate: result.generatedDate, generatedTime: result.generatedTime,
    disclosureAllowed: result.disclosureAllowed, processedPercentage: result.processedPercentage,
    processedSections: result.processedSections, totalSections: result.totalSections, progress: result.progress,
    validVotes: result.disclosureAllowed ? result.validVotes : null,
    blankVotes: result.disclosureAllowed ? result.blankVotes : null,
    nullVotes: result.disclosureAllowed ? result.nullVotes : null,
    turnout: result.disclosureAllowed ? result.turnout : null,
    abstention: result.disclosureAllowed ? result.abstention : null,
    candidates: result.disclosureAllowed ? result.candidates.map(({ id, number, name, party, votes, percentage, status, voteDestination }) =>
      ({ id, number, name, party, votes, percentage, status, voteDestination })).sort((a, b) => a.id.localeCompare(b.id)) : []
  };
}

export function snapshotContent(snapshot: ElectionSnapshot): string {
  const { id, observedAt, generatedDate, generatedTime, ...content } = snapshot;
  return JSON.stringify(content);
}
