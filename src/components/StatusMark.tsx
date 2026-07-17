import type { DataStatus, MetricTone } from '../data'

const labels: Record<DataStatus, string> = {
  verified: '已验证',
  review: '待复核',
}

export function StatusMark({ status }: { status: DataStatus }) {
  return <span className={`status-mark ${status}`}>{labels[status]}</span>
}

export function ToneMark({ tone }: { tone: MetricTone }) {
  const labels: Record<MetricTone, string> = {
    calm: '平稳',
    watch: '留意',
    stress: '压力',
    review: '待复核',
  }

  return <span className={`tone-mark ${tone}`}>{labels[tone]}</span>
}
