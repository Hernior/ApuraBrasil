import { init, use, ComposeOption } from 'echarts/core';
import { LineChart, LineSeriesOption } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent, AriaComponentOption, GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { EvolutionMetric, EvolutionModel } from './evolution-model';

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, SVGRenderer]);
type EvolutionOption = ComposeOption<LineSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption | AriaComponentOption>;
const palette = ['#155e75', '#a16207', '#7c3aed', '#be185d', '#047857', '#c2410c', '#1d4ed8', '#475569'];
const candidateColor = (id: string) => palette[Array.from(id).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % palette.length]!;

export function createEvolutionChart(element: HTMLElement) {
  return init(element, undefined, { renderer: 'svg' });
}

export function evolutionOptions(model: EvolutionModel, metric: EvolutionMetric = 'percentage'): EvolutionOption {
  const processed = model.series.flatMap(series => series.points.map(point => point.processedPercentage))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0 && value <= 100);
  const minimum = processed.reduce((min, value) => Math.min(min, value), 100);
  const maximum = processed.reduce((max, value) => Math.max(max, value), 0);
  const margin = Math.max((maximum - minimum) * .1, .1);
  const xMin = processed.length ? Number(Math.max(0, minimum - margin).toFixed(6)) : 0;
  const xMax = processed.length ? Number(Math.min(100, maximum + margin).toFixed(6)) : 100;
  return {
    animation: false,
    aria: { enabled: true },
    legend: { type: 'scroll', top: 0 },
    grid: { left: 55, right: 20, top: 65, bottom: 65 },
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true,
      valueFormatter: value => typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(value) },
    xAxis: { type: 'value', min: xMin, max: xMax, name: 'Seções totalizadas (%)', nameLocation: 'middle', nameGap: 35, axisLabel: { formatter: value => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%` } },
    yAxis: metric === 'percentage'
      ? { type: 'value', min: 0, max: 100, name: 'Percentual TSE (%)', axisLabel: { formatter: '{value}%' } }
      : { type: 'value', min: 0, minInterval: 1, name: 'Votos acumulados', axisLabel: { formatter: value => value.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }) } },
    series: model.series.map(series => ({
      id: series.id, name: series.name, type: 'line', smooth: false, connectNulls: false, showSymbol: true,
      itemStyle: { color: candidateColor(series.id) }, lineStyle: { color: candidateColor(series.id) },
      dimensions: ['Seções totalizadas (%)', 'Percentual TSE (%)', 'Votos', 'Arquivo TSE', 'Recebido neste navegador'],
      encode: { x: 0, y: metric === 'votes' ? 2 : 1, tooltip: [3, 4, 0, 2, 1] },
      data: series.points.map(point => [point.processedPercentage ?? '-', point.percentage ?? '-', point.votes ?? '-', point.generatedAt, point.observedAt])
    }))
  };
}
