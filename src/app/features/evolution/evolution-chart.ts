import { init, use, ComposeOption } from 'echarts/core';
import { LineChart, LineSeriesOption } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent, AriaComponentOption, GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { EvolutionModel } from './evolution-model';

use([LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, SVGRenderer]);
type EvolutionOption = ComposeOption<LineSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption | AriaComponentOption>;
const palette = ['#155e75', '#a16207', '#7c3aed', '#be185d', '#047857', '#c2410c', '#1d4ed8', '#475569'];
const candidateColor = (id: string) => palette[Array.from(id).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % palette.length]!;

export function createEvolutionChart(element: HTMLElement) {
  return init(element, undefined, { renderer: 'svg' });
}

export function evolutionOptions(model: EvolutionModel): EvolutionOption {
  return {
    animation: false,
    aria: { enabled: true },
    legend: { type: 'scroll', top: 0 },
    grid: { left: 55, right: 20, top: 65, bottom: 65 },
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true,
      valueFormatter: value => typeof value === 'number' ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : String(value) },
    xAxis: { type: 'value', min: 0, max: 100, name: 'Seções totalizadas (%)', nameLocation: 'middle', nameGap: 35, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'value', min: 0, max: 100, name: 'Percentual TSE (%)', axisLabel: { formatter: '{value}%' } },
    series: model.series.map(series => ({
      id: series.id, name: series.name, type: 'line', smooth: false, connectNulls: false, showSymbol: true,
      itemStyle: { color: candidateColor(series.id) }, lineStyle: { color: candidateColor(series.id) },
      dimensions: ['Seções totalizadas (%)', 'Percentual TSE (%)', 'Votos', 'Arquivo TSE', 'Recebido neste navegador'],
      encode: { x: 0, y: 1, tooltip: [3, 4, 0, 2, 1] },
      data: series.points.map(point => [point.processedPercentage ?? '-', point.percentage ?? '-', point.votes ?? '-', point.generatedAt, point.observedAt])
    }))
  };
}
