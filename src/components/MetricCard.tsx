import { ArrowUpRight, Info } from 'lucide-react'
import type { Metric } from '../data'
import { ToneMark } from './StatusMark'

interface MetricCardProps {
  metric: Metric
  onInspect: (metric: Metric) => void
}

export function MetricCard({ metric, onInspect }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-topline">
        <span>{metric.label}</span>
        <ToneMark tone={metric.tone} />
      </div>
      <strong className="metric-value">{metric.value}</strong>
      <p className="metric-detail">{metric.detail}</p>
      <button className="inspect-link" type="button" onClick={() => onInspect(metric)} aria-label={`查看${metric.label}的指标解读`}>
        <Info size={15} aria-hidden="true" />
        指标解读
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </article>
  )
}
