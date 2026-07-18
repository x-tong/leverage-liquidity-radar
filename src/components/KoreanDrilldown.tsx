import { useMemo, useState } from 'react'
import { latestKoreaDrilldown } from '../generated/latestKoreaDrilldown'

type DrilldownMode = 'liquidation' | 'credit'
type DrilldownRange = '1Y' | '5Y' | '10Y'
type KoreaDrilldownPoint = (typeof latestKoreaDrilldown.points)[number]

const ranges: DrilldownRange[] = ['1Y', '5Y', '10Y']

function pointsForRange(points: readonly KoreaDrilldownPoint[], range: DrilldownRange) {
  const latest = points.at(-1)
  if (!latest) return []
  const cutoff = new Date(`${latest.label}T00:00:00Z`)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - Number.parseInt(range, 10))
  const cutoffLabel = cutoff.toISOString().slice(0, 10)
  return points.filter((point) => point.label >= cutoffLabel)
}

function compactForBars(points: readonly KoreaDrilldownPoint[], limit = 360) {
  if (points.length <= limit) return points
  return Array.from({ length: limit }, (_, index) => {
    const start = Math.floor((index / limit) * points.length)
    const end = Math.max(start + 1, Math.floor(((index + 1) / limit) * points.length))
    return points.slice(start, end).reduce((largest, point) => (
      point.forcedLiquidationMillions > largest.forcedLiquidationMillions ? point : largest
    ))
  })
}

function compactForLines(points: readonly KoreaDrilldownPoint[], limit = 360) {
  if (points.length <= limit) return points
  return Array.from({ length: limit }, (_, index) => points[Math.round((index / (limit - 1)) * (points.length - 1))])
}

function axisTicks(maximum: number) {
  return [0, maximum / 2, maximum]
}

function formatWonBillions(millions: number) {
  return `₩${(millions / 1_000).toFixed(1)}bn`
}

function formatWonTrillions(millions: number) {
  return `₩${(millions / 1_000_000).toFixed(2)}tn`
}

function tickLabel(value: number, unit: 'bn' | 'tn') {
  return unit === 'bn' ? value.toFixed(0) : value.toFixed(1)
}

export function KoreanDrilldown() {
  const drilldown = latestKoreaDrilldown
  const [mode, setMode] = useState<DrilldownMode>('liquidation')
  const [range, setRange] = useState<DrilldownRange>('1Y')
  const selected = useMemo(() => pointsForRange(drilldown.points, range), [drilldown.points, range])
  const latest = selected.at(-1)
  const displayed = useMemo(() => (
    mode === 'liquidation' ? compactForBars(selected) : compactForLines(selected)
  ), [mode, selected])

  if (!latest || displayed.length === 0) return null

  const width = 1_000
  const height = 286
  const padding = { top: 20, right: 22, bottom: 40, left: 56 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const unit = mode === 'liquidation' ? 'bn' : 'tn'
  const values = mode === 'liquidation'
    ? displayed.map((point) => point.forcedLiquidationMillions / 1_000)
    : displayed.flatMap((point) => [point.totalCreditSupplyMillions, point.marginCreditMillions, point.collateralLoanMillions].map((value) => value / 1_000_000))
  const max = Math.max(...values, 1) * 1.12
  const y = (value: number) => padding.top + (1 - value / max) * plotHeight
  const x = (index: number) => padding.left + (index / Math.max(displayed.length - 1, 1)) * plotWidth
  const tickPoints = axisTicks(max)
  const middleIndex = Math.floor(displayed.length / 2)
  const creditSeries = [
    { key: 'total', label: '信用供与总额', color: '#157a79', value: (point: KoreaDrilldownPoint) => point.totalCreditSupplyMillions / 1_000_000 },
    { key: 'margin', label: '信用融资', color: '#c67928', value: (point: KoreaDrilldownPoint) => point.marginCreditMillions / 1_000_000 },
    { key: 'collateral', label: '担保融资', color: '#5a7fbe', value: (point: KoreaDrilldownPoint) => point.collateralLoanMillions / 1_000_000 },
  ] as const
  const liquidationFiveDayAverage = selected.slice(-5).reduce((sum, point) => sum + point.forcedLiquidationMillions, 0) / Math.min(selected.length, 5)
  const recentPoints = selected.slice(-5).reverse()

  return (
    <section className="korean-drilldown" aria-labelledby="korean-drilldown-heading">
      <div className="section-heading">
        <div>
          <p>韩国专项监控</p>
          <h2 id="korean-drilldown-heading">不要只看单一杠杆比率</h2>
        </div>
        <div className="drilldown-controls" aria-label="韩国专项监控控制项">
          <div className="range-control" aria-label="时间范围">
            {ranges.map((item) => (
              <button key={item} type="button" className={range === item ? 'selected' : ''} onClick={() => setRange(item)} aria-pressed={range === item}>{item}</button>
            ))}
          </div>
          <div className="range-control" aria-label="观察维度">
            <button type="button" className={mode === 'liquidation' ? 'selected' : ''} onClick={() => setMode('liquidation')} aria-pressed={mode === 'liquidation'}>强平</button>
            <button type="button" className={mode === 'credit' ? 'selected' : ''} onClick={() => setMode('credit')} aria-pressed={mode === 'credit'}>信用供与</button>
          </div>
        </div>
      </div>

      {mode === 'liquidation' ? (
        <div className="drilldown-summary">
          <div><span>最新强平</span><strong>{formatWonBillions(latest.forcedLiquidationMillions)}</strong></div>
          <div><span>5 日均值</span><strong>{formatWonBillions(liquidationFiveDayAverage)}</strong></div>
          <div><span>强平 / 未收额</span><strong>{latest.forcedLiquidationToUnpaidPercent.toFixed(2)}%</strong></div>
        </div>
      ) : (
        <div className="drilldown-summary credit-summary">
          {creditSeries.map((series) => (
            <div key={series.key}><span><i style={{ background: series.color }} />{series.label}</span><strong>{formatWonTrillions(series.value(latest) * 1_000_000)}</strong></div>
          ))}
        </div>
      )}

      <div
        className="drilldown-chart"
        role="img"
        aria-label={mode === 'liquidation'
          ? `强制平仓日频图，近${range}最新值${formatWonBillions(latest.forcedLiquidationMillions)}，五日均值${formatWonBillions(liquidationFiveDayAverage)}`
          : `信用供与日频图，近${range}最新总额${formatWonTrillions(latest.totalCreditSupplyMillions)}，信用融资${formatWonTrillions(latest.marginCreditMillions)}，担保融资${formatWonTrillions(latest.collateralLoanMillions)}`}
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {tickPoints.map((tick) => (
            <g key={tick}>
              <line className="grid-line" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
              <text className="axis-text" x={padding.left - 10} y={y(tick) + 4} textAnchor="end">{tickLabel(tick, unit)}</text>
            </g>
          ))}
          {mode === 'liquidation' ? displayed.map((point, index) => {
            const value = point.forcedLiquidationMillions / 1_000
            const barWidth = Math.max(1, (plotWidth / displayed.length) * 0.78)
            return <rect key={point.label} className="liquidation-bar" x={x(index) - barWidth / 2} y={y(value)} width={barWidth} height={Math.max(1, padding.top + plotHeight - y(value))} />
          }) : creditSeries.map((series) => {
            const points = displayed.map((point, index) => `${x(index)},${y(series.value(point))}`).join(' ')
            return <polyline key={series.key} className="drilldown-line" style={{ stroke: series.color }} points={points} />
          })}
          {[0, middleIndex, displayed.length - 1].map((index) => (
            <text key={index} className="axis-text x-axis" x={x(index)} y={height - 13} textAnchor={index === 0 ? 'start' : index === displayed.length - 1 ? 'end' : 'middle'}>{displayed[index]?.label}</text>
          ))}
        </svg>
        <span className="chart-unit">单位 {unit === 'bn' ? '十亿韩元' : '万亿韩元'}</span>
      </div>

      {mode === 'liquidation' ? (
        <div className="drilldown-table-wrap">
          <table>
            <caption>最近 5 个交易日的 KOFIA 强平记录</caption>
            <thead><tr><th>日期</th><th>强平金额</th><th>未收额</th><th>公布比例</th></tr></thead>
            <tbody>{recentPoints.map((point) => <tr key={point.label}><td>{point.label}</td><td>{formatWonBillions(point.forcedLiquidationMillions)}</td><td>{formatWonBillions(point.unpaidReceivablesMillions)}</td><td>{point.forcedLiquidationToUnpaidPercent.toFixed(2)}%</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="drilldown-table-wrap">
          <table>
            <caption>最新交易日的信用供与组成</caption>
            <thead><tr><th>项目</th><th>余额</th><th>占信用供与总额</th></tr></thead>
            <tbody>
              {[
                ['信用融资', latest.marginCreditMillions],
                ['信用交易大株', latest.creditShortMillions],
                ['申购资金贷款', latest.subscriptionLoanMillions],
                ['证券担保融资', latest.collateralLoanMillions],
              ].map(([label, value]) => <tr key={String(label)}><td>{label}</td><td>{formatWonTrillions(Number(value))}</td><td>{((Number(value) / latest.totalCreditSupplyMillions) * 100).toFixed(2)}%</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      <p className="source-line">
        KOFIA FreeSIS 日频原始字段 · {drilldown.start} 至 {drilldown.asOf} · 强平比例使用 KOFIA 公布字段，不以两个金额自行反算。{' '}
        <a href={drilldown.sourceUrl} target="_blank" rel="noreferrer">资金与强平来源</a>{' · '}
        <a href={drilldown.creditSourceUrl} target="_blank" rel="noreferrer">信用供与来源</a>{' · '}
        <a href={drilldown.archiveUrl} target="_blank" rel="noreferrer">已归档快照</a>
      </p>
    </section>
  )
}
