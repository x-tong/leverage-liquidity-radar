import { lazy, Suspense, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, BookOpen, Database, Menu, PanelLeftClose, ShieldCheck } from 'lucide-react'
import { AuditDrawer } from './components/AuditDrawer'
import { LineChart } from './components/LineChart'
import { MetricCard } from './components/MetricCard'
import { SourceHealth } from './components/SourceHealth'
import { StatusMark } from './components/StatusMark'
import { latestSnapshotDate, markets, type HistoryPoint, type HistoryRange, type MarketId, type Metric } from './data'

const marketOrder: MarketId[] = ['us', 'jp', 'kr']
const KoreanDrilldown = lazy(async () => {
  const module = await import('./components/KoreanDrilldown')
  return { default: module.KoreanDrilldown }
})

const navItems = [
  { icon: Activity, label: '总览', href: '#overview', current: true },
  { icon: ShieldCheck, label: '口径审计', href: '#metrics', current: false },
  { icon: Database, label: '数据健康', href: '#source-health', current: false },
  { icon: BookOpen, label: '阅读指南', href: '#read-notes', current: false },
]

const primarySignals: Record<MarketId, Array<{ id: string, question: string }>> = {
  kr: [
    { id: 'kr-liquidation-average', question: '风险是否已经变成被动卖盘？' },
    { id: 'kr-r2', question: '显性融资处在什么位置？' },
    { id: 'kr-capital-capacity', question: '广义信用相对资本是否偏紧？' },
  ],
  us: [
    { id: 'finra-debit', question: '显性股票杠杆规模有多大？' },
    { id: 'finra-credit-buffer', question: '账户内静态缓冲有多厚？' },
    { id: 'us-hy-oas', question: '信用融资环境是否收紧？' },
  ],
  jp: [
    { id: 'jp-buy-sell', question: '融资余额当前偏向哪一侧？' },
    { id: 'jp-net-long', question: '偏多存量由什么驱动？' },
    { id: 'jp-purchases', question: '融资买入余额规模如何？' },
  ],
}

const metricGroups: Record<MarketId, Array<{ title: string, description: string, ids: string[] }>> = {
  kr: [
    {
      title: '杠杆与信用',
      description: '融资、强平与券商资本是不同层次的风险读数；放在一起看，不把它们相加成分数。',
      ids: ['kr-r2', 'kr-liquidation-average', 'kr-liquidation-ratio', 'kr-total-credit', 'kr-capital-capacity'],
    },
    {
      title: '市场背景',
      description: '指数、市场规模与外资持股帮助定位环境，不替代对杠杆机制的判断。',
      ids: ['kr-kospi-close', 'kr-kosdaq-close', 'kr-market-cap-gdp', 'kr-kospi-foreign-ownership'],
    },
    {
      title: '杠杆 / 反向 ETF',
      description: '设置赎回、规模、溢折价与份额变化各自说明不同事情；CU 不是资金流。',
      ids: ['kr-geared-etf-net-setred-cu', 'kr-geared-etf-net-assets', 'kr-geared-etf-premium', 'kr-geared-etf-issued-shares'],
    },
  ],
  us: [
    {
      title: '杠杆与融资环境',
      description: '先区分账户内杠杆与宏观融资背景，再判断两类信号是否一致。',
      ids: ['finra-debit', 'finra-credit-buffer', 'us-hy-oas', 'us-fed-assets'],
    },
  ],
  jp: [
    {
      title: '融资余额结构',
      description: '余额以股数计，不同股票价格差异不会反映在这里。',
      ids: ['jp-buy-sell', 'jp-purchases', 'jp-sales', 'jp-net-long'],
    },
  ],
}

function applyHistoryRange(points: HistoryPoint[], range: HistoryRange) {
  if (range === '全部' || points.length < 2) return points
  const latest = new Date(`${points.at(-1)?.label}T00:00:00Z`)
  if (Number.isNaN(latest.getTime())) return points
  latest.setUTCFullYear(latest.getUTCFullYear() - (range === '1Y' ? 1 : range === '5Y' ? 5 : 10))
  const threshold = latest.toISOString().slice(0, 10)
  return points.filter((point) => point.label >= threshold)
}

function SignalCard({ metric, question, onInspect }: { metric: Metric, question: string, onInspect: (metric: Metric) => void }) {
  return (
    <article className={`signal-card ${metric.tone}`}>
      <p>{question}</p>
      <h3>{metric.label}</h3>
      <strong>{metric.value}</strong>
      <span>{metric.detail}</span>
      <button type="button" onClick={() => onInspect(metric)} aria-label={`查看${metric.label}的指标解读`}>
        查看口径 <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </article>
  )
}

function App() {
  // Korea is the daily-monitoring default. The other markets remain one tap
  // away, but opening the terminal now lands on its deepest verified workflow.
  const [selectedMarket, setSelectedMarket] = useState<MarketId>('kr')
  const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [range, setRange] = useState<HistoryRange>('1Y')
  const [secondaryRange, setSecondaryRange] = useState<HistoryRange>('10Y')
  const market = markets[selectedMarket]
  const checkedCount = useMemo(() => Object.values(markets).filter((item) => item.status === 'verified').length, [])
  const metricsById = useMemo(() => new Map(market.metrics.map((metric) => [metric.id, metric])), [market.metrics])
  const activeSignals = primarySignals[selectedMarket]
    .map((signal) => ({ ...signal, metric: metricsById.get(signal.id) }))
    .filter((signal): signal is { id: string, question: string, metric: Metric } => signal.metric !== undefined)
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
          <div className="breadcrumb">{market.name} <span>/</span> 杠杆与流动性</div>
          <div className="topbar-meta"><span className="live-dot" aria-hidden="true" />数据快照 {latestSnapshotDate}</div>
        </header>

        <div className="page-content" id="overview">
          <section className="market-tabs market-tabs-top" aria-label="选择市场">
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

          <section className="market-overview" aria-labelledby="market-heading">
            <div className="market-overview-copy">
              <p className="section-kicker">{market.exchange} · 研究视图</p>
              <h1 id="market-heading">{market.headline}</h1>
              <p>{market.description}</p>
            </div>
            <div className="market-facts">
              <div>
                <span>数据截至</span>
                <strong>{market.updated}</strong>
                <small>{market.freshness}</small>
              </div>
              <div className={`freshness-note ${market.status}`}>
                <StatusMark status={market.status} />
                <p>{market.statusNote}</p>
              </div>
            </div>
          </section>

          <section className="reading-route" id="read-notes" aria-labelledby="read-notes-heading">
            <div className="route-heading">
              <p>建议阅读顺序</p>
              <h2 id="read-notes-heading">{market.readingGuide.title}</h2>
            </div>
            <ol>
              {market.readingGuide.steps.map((step, index) => (
                <li key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="signal-section" aria-labelledby="signal-heading">
            <div className="section-heading signal-heading">
              <div>
                <p>当前优先信号</p>
                <h2 id="signal-heading">先回答这三个问题</h2>
              </div>
              <span>点击任一读数，查看含义、当前解释与可复算口径。</span>
            </div>
            <div className="signal-strip">
              {activeSignals.map(({ id, question, metric }) => <SignalCard key={id} metric={metric} question={question} onInspect={setSelectedMetric} />)}
            </div>
          </section>

          {market.id === 'kr' && (
            <Suspense fallback={<section className="korean-drilldown drilldown-loading" aria-label="正在加载韩国专项监控">正在加载韩国逐日明细...</section>}>
              <KoreanDrilldown />
            </Suspense>
          )}

          <section className="evidence-section" id="metrics" aria-labelledby="evidence-heading">
            <div className="section-heading evidence-heading">
              <div>
                <p>完整证据</p>
                <h2 id="evidence-heading">按机制展开，而不是合成一个风险分数</h2>
              </div>
              <span>每张指标卡均可展开审计信息。</span>
            </div>
            {metricGroups[selectedMarket].map((group) => {
              const groupMetrics = group.ids.map((id) => metricsById.get(id)).filter((metric): metric is Metric => metric !== undefined)
              if (groupMetrics.length === 0) return null
              return (
                <section className="metric-group" aria-label={group.title} key={group.title}>
                  <div className="metric-group-heading">
                    <div>
                      <h3>{group.title}</h3>
                      <p>{group.description}</p>
                    </div>
                    <span>{groupMetrics.length} 项</span>
                  </div>
                  <div className="metric-grid">
                    {groupMetrics.map((metric) => <MetricCard key={metric.id} metric={metric} onInspect={setSelectedMetric} />)}
                  </div>
                </section>
              )
            })}
          </section>

          <section className="analysis-grid single-column">
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
