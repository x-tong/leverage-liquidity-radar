import type { HistoryPoint } from '../data'

interface LineChartProps {
  points: HistoryPoint[]
  unit: string
}

export function LineChart({ points, unit }: LineChartProps) {
  const width = 760
  const height = 270
  const padding = { top: 22, right: 20, bottom: 38, left: 52 }
  const values = points.map((point) => point.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const paddingValue = rawMax === rawMin ? Math.max(Math.abs(rawMin) * 0.08, 1) : (rawMax - rawMin) * 0.12
  const min = rawMin - paddingValue
  const max = rawMax + paddingValue
  const span = Math.max(max - min, 1)
  const tickPrecision = span < 10 ? 1 : 0
  const x = (index: number) => padding.left + (index / Math.max(points.length - 1, 1)) * (width - padding.left - padding.right)
  const y = (value: number) => padding.top + (1 - (value - min) / span) * (height - padding.top - padding.bottom)
  const polyline = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')
  const ticks = [min, min + span / 2, max]

  return (
    <div className="chart-wrap" role="img" aria-label={`折线图，当前值 ${points.at(-1)?.value} ${unit}`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#157a79" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#157a79" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis-text" x={padding.left - 10} y={y(tick) + 4} textAnchor="end">
              {tick.toFixed(tickPrecision)}
            </text>
          </g>
        ))}
        <polygon
          className="area-fill"
          points={`${padding.left},${height - padding.bottom} ${polyline} ${width - padding.right},${height - padding.bottom}`}
        />
        <polyline className="chart-line" points={polyline} />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle className={index === points.length - 1 ? 'chart-dot latest' : 'chart-dot'} cx={x(index)} cy={y(point.value)} r={index === points.length - 1 ? 4.6 : 2.3} />
            {(index === 0 || index === points.length - 1 || index === 6) && (
              <text className="axis-text x-axis" x={x(index)} y={height - 13} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="chart-unit">单位 {unit}</div>
    </div>
  )
}
