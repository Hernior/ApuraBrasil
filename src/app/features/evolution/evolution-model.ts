import { ElectionSnapshot } from '../../core/models/election-snapshot.model';

export type EvolutionLimit = '2' | '3' | '5' | 'all';
export type EvolutionMetric = 'percentage' | 'votes';

export function buildEvolutionModel(snapshots: ElectionSnapshot[], limit: EvolutionLimit) {
  const latest = snapshots.at(-1);
  const candidates = [...(latest?.candidates ?? [])].sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1) || a.id.localeCompare(b.id));
  const selected = limit === 'all' ? candidates : candidates.slice(0, Number(limit));
  return {
    candidates: selected,
    series: selected.map(candidate => ({
      id: candidate.id,
      name: `${candidate.number} · ${candidate.name} (${candidate.party})`,
      points: snapshots.map(snapshot => {
        const observation = snapshot.disclosureAllowed ? snapshot.candidates.find(c => c.id === candidate.id) : undefined;
        return {
          processedPercentage: snapshot.processedPercentage,
          percentage: observation?.percentage ?? null,
          votes: observation?.votes ?? null,
          generatedAt: `${snapshot.generatedDate} ${snapshot.generatedTime}`,
          observedAt: new Date(snapshot.observedAt).toLocaleString('pt-BR')
        };
      })
    }))
  };
}
export type EvolutionModel = ReturnType<typeof buildEvolutionModel>;
