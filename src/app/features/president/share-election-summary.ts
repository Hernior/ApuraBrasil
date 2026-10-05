import { Candidate } from '../../core/models/candidate.model';
import { ElectionResult } from '../../core/models/election-result.model';

export interface ShareSummaryOptions {
  result: ElectionResult;
  officeName: string;
  location: string;
  url: string;
  officialStatus: (candidate: Candidate) => string;
  calculatedStatus: (candidate: Candidate) => string;
  confirmedStatus?: (candidate: Candidate) => string;
  notice?: string;
}

const plain = (text: string) => text.replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
const number = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR');
const percentage = (value: number | null) => value === null ? '—' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function buildElectionShareSummary(options: ShareSummaryOptions): string {
  const { result, officeName, location, url } = options;
  const lines = [
    '*ApuraBrasil — Resumo da apuração*',
    ...(result.phase === 's' ? ['*SIMULADO — não são resultados oficiais*'] : []),
    `*Cargo:* ${plain(officeName)}`,
    `*Local:* ${plain(location)}`,
    `*Turno:* ${result.round}º`,
    `*Seções totalizadas:* ${percentage(result.processedPercentage)}`,
    `*Arquivo TSE:* ${plain(result.generatedDate)} às ${plain(result.generatedTime)}`,
    `*Etapa:* ${result.progress === 'n' ? 'Totalização não iniciada' : result.progress === 'p' ? 'Totalização em andamento' : 'Totalização finalizada'}`
  ];
  if (options.notice) lines.push(plain(options.notice));
  const statewide = result.stateResult;
  if (statewide && ['3', '5', '6', '7', '8'].includes(result.officeCode ?? '')) {
    lines.push(`Votos municipais; situação e indicação de eleição referentes à UF. Arquivo estadual: ${plain(statewide.generatedDate)} às ${plain(statewide.generatedTime)} (${percentage(statewide.processedPercentage)} das seções).`);
  }
  if (result.nationalResult && result.scopeCode !== 'br') lines.push(`Votação local; ELEITO e 2º TURNO referem-se à apuração nacional de Presidente. Arquivo nacional: ${plain(result.nationalResult.generatedDate)} às ${plain(result.nationalResult.generatedTime)}.`);
  if (!result.disclosureAllowed) {
    lines.push('', 'O TSE ainda não autorizou a divulgação da votação.');
  } else {
    lines.push('', '*Até 5 candidatos mais votados no recorte:*');
    const candidates = [...result.candidates].sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1)).slice(0, 5);
    candidates.forEach((candidate, index) => {
      lines.push('', `${index + 1}. *${plain(candidate.name)}* — ${plain(candidate.number)} · ${plain(candidate.party)}`,
        `${number(candidate.votes)} votos · ${percentage(candidate.percentage)}`,
        `Situação TSE: ${plain(options.officialStatus(candidate))}`);
      if (candidate.voteDestination) lines.push(`Destinação: ${plain(candidate.voteDestination)}`);
      const calculated = options.calculatedStatus(candidate);
      const confirmed = options.confirmedStatus?.(candidate);
      if (confirmed) lines.push(`Confirmação: ${plain(confirmed)}`);
      if (calculated) lines.push(`ApuraBrasil: ${plain(calculated)}`);
    });
    if (!candidates.length) lines.push('Nenhum candidato disponibilizado.');
    lines.push('', 'Percentuais dos candidatos conforme o TSE. Indicações provisórias podem mudar durante a apuração.');
  }
  lines.push('', 'Fonte dos dados: TSE', url);
  return lines.join('\n');
}
