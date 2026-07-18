import { useMemo, useState } from 'react'
import { Activity, BookOpen, Database, Menu, PanelLeftClose, ShieldCheck } from 'lucide-react'
import { AuditDrawer } from './components/AuditDrawer'
import { LineChart } from './components/LineChart'
import { MetricCard } from './components/MetricCard'
import { SourceHealth } from './components/SourceHealth'
import { StatusMark } from './components/StatusMark'
import { latestSnapshotDate, markets, type HistoryPoint, type HistoryRange, type MarketId, type Metric } from './data'

const marketOrder: MarketId[] = ['us', 'jp', 'kr']

const navItems = [
  { icon: Activity, label: '总览', href: '#overview', current: true },
  { icon: ShieldCheck, label: '口径审计', href: '#metrics', current: false },
  { icon: Database, label: '数据健康', href: '#source-health', current: false },
  { icon: BookOpen, label: '阅读原则', href: '#read-notes', current: false },
]

function applyHistoryRange(points: HistoryPoint[], range: HistoryRange) {
  if (range === '全部' || points.length < 2) return points
  const latest = new Date(`${points.at(-1)?.label}T00:00:00Z`)
  if (Number.isNaN(latest.getTime())) return points
  latest.setUTCFullYear(latest.getUTCFullYear() - (range === '1Y' ? 1 : range === '5Y' ? 5 : 10))
  const threshold = latest.toISOString().slice(0, 10)
  return points.filter((point) => point.label >= threshold)
}

function App() {
  const [selectedMarket, setSelectedMarket] = useState<MarketId>('us')
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [range, setRange] = useState<HistoryRange>('1Y')
  const [secondaryRange, setSecondaryRange] = useState<HistoryRange>('10Y')
  const market = markets[selectedMarket]
  const checkedCount = useMemo(() => Object.values(markets).filter((item) => item.status === 'verified').length, [])
  const visibleHistory = useMemo(() => market.history ? applyHistoryRange(market.history.points, range) : [], [market.history, range])
  const visibleSecondaryHistory = useMemo(() => market.secondaryHistory ? applyHistoryRange(market.secondaryHistory.points, secondaryRange) : [], [market.secondaryHistory, secondaryRange])

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="主导航">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">L/L</div>
          <div>
            <strong>LEV / LIQ</strong>
            <span>个人市场观测站</span>
          </div>
        </div>
        <nav className="side-nav">
          {navItems.map(({ icon: Icon, label, href, current }) => (
            <a className={current ? 'nav-item active' : 'nav-item'} href={href} key={label} onClick={() => setSidebarOpen(false)}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>审计覆盖</span>
          <strong>{checkedCount} / 3 市场已验证</strong>
          <div className="coverage-bar" aria-label={`${checkedCount} / 3 市场已验证`}><i style={{ width: `${(checkedCount / 3) * 100}%` }} /></div>
          <p>先让数据诚实，再让信号有用。</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" type="button" onClick={() => setSidebarOpen((open) => !open)} aria-label="切换导航">
            {sidebarOpen ? <PanelLeftClose size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
          <div className="breadcrumb">市场总览 <span>/</span> 杠杆与流动性</div>
          <div className="topbar-meta"><span className="live-dot" aria-hidden="true" />数据快照 {latestSnapshotDate}</div>
        </header>

        <div className="page-content" id="overview">
          <section className="intro-panel">
            <div>
              <p className="section-kicker">个人研究终端</p>
              <h1>用可追溯的数据，观察杠杆如何累积。</h1>
              <p className="intro-copy">韩股、日股、美股各用自己的数据频率与风险语言。页面不会将不同口径压成一个结论，也不会把延迟数据伪装成实时。</p>
            </div>
            <div className="method-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <span>每个读数均可展开来源、公式、频率与局限。</span>
            </div>
          </section>

          <section className="market-tabs" aria-label="选择市场">
            {marketOrder.map((marketId) => {
              const item = markets[marketId]
              return (
                <button
                  type="button"
                  className={selectedMarket === marketId ? 'market-tab selected' : 'market-tab'}
                  onClick={() => setSelectedMarket(marketId)}
                  key={marketId}
                  aria-pressed={selectedMarket === marketId}
                >
                  <span className="market-code">{item.code}</span>
                  <span className="market-name">{item.name}</span>
                  <StatusMark status={item.status} />
                </button>
              )
            })}
          </section>

          <section className="market-brief" aria-labelledby="market-heading">
            <div className="market-identity">
              <p>{market.exchange}</p>
              <h2 id="market-heading">{market.headline}</h2>
              <span>{market.updated} 更新 · {market.freshness}</span>
            </div>
            <p className="market-description">{market.description}</p>
            <div className={`freshness-note ${market.status}`}>
              <StatusMark status={market.status} />
              <p>{market.statusNote}</p>
            </div>
          </section>

          <section className="metric-grid" id="metrics" aria-label={`${market.name} 核心指标`}>
            {market.metrics.map((metric) => <MetricCard key={metric.id} metric={metric} onInspect={setSelectedMetric} />)}
          </section>

          <section className="analysis-grid">
            {market.history ? (
              <section className="chart-panel" aria-labelledby="history-heading">
                <div className="section-heading">
                  <div>
                    <p>历史轨迹</p>
                    <h2 id="history-heading">{market.history.title}</h2>
                  </div>
                  {market.history.ranges && (
                    <div className="range-control" aria-label="历史范围">
                      {market.history.ranges.map((item) => (
                        <button key={item} type="button" className={range === item ? 'selected' : ''} onClick={() => setRange(item)} aria-pressed={range === item}>{item}</button>
                      ))}
                    </div>
                  )}
                </div>
                <LineChart points={visibleHistory} unit={market.history.unit} />
                <p className="source-line">{market.history.source} · 数值取自原始来源，不作市场预测。</p>
              </section>
            ) : (
              <section className="chart-panel pending-history" aria-labelledby="history-heading">
                <div className="section-heading">
                  <div>
                    <p>历史轨迹</p>
                    <h2 id="history-heading">等待可审计观察序列</h2>
                  </div>
                  <StatusMark status={market.status} />
                </div>
                <div className="empty-chart">
                  <span className="empty-axis vertical" />
                  <span className="empty-axis horizontal" />
                  <div>
                    <strong>不会用合成历史填满这里。</strong>
                    <p>数据更新任务会保留每次原始快照；积累足够观察值后才显示可复算趋势。</p>
                  </div>
                </div>
              </section>
            )}

            <aside className="read-notes" id="read-notes" aria-labelledby="read-notes-heading">
              <p>如何阅读</p>
              <h2 id="read-notes-heading">先看口径，再看方向</h2>
              <ol>
                <li><span>01</span>确认来源是否已验证，以及数据本身的发布时间。</li>
                <li><span>02</span>只在同一市场、同一口径内比较历史变化。</li>
                <li><span>03</span>将杠杆、信用与流动性视为不同维度，而不是单一风险分数。</li>
              </ol>
            </aside>
          </section>

          {market.secondaryHistory && (
            <section className="chart-panel secondary-history" aria-labelledby="secondary-history-heading">
              <div className="section-heading">
                <div>
                  <p>估值轨迹</p>
                  <h2 id="secondary-history-heading">{market.secondaryHistory.title}</h2>
                </div>
                {market.secondaryHistory.ranges && (
                  <div className="range-control" aria-label="估值历史范围">
                    {market.secondaryHistory.ranges.map((item) => (
                      <button key={item} type="button" className={secondaryRange === item ? 'selected' : ''} onClick={() => setSecondaryRange(item)} aria-pressed={secondaryRange === item}>{item}</button>
                    ))}
                  </div>
                )}
              </div>
              <LineChart points={visibleSecondaryHistory} unit={market.secondaryHistory.unit} />
              <p className="source-line">{market.secondaryHistory.source} · GDP 为年度分母，数值可能随 GDP 修订而变化。</p>
            </section>
          )}

          <SourceHealth />
        </div>
      </main>
      <AuditDrawer metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
    </div>
  )
}

export default App
