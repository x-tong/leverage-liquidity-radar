import { latestJP } from './generated/latestJp'
import { latestUS } from './generated/latestUs'

export type MarketId = 'kr' | 'jp' | 'us'

export type DataStatus = 'verified' | 'review'

export type MetricTone = 'calm' | 'watch' | 'stress' | 'review'

export interface Metric {
  id: string
  label: string
  value: string
  detail: string
  tone: MetricTone
  source: string
  sourceUrl: string
  frequency: string
  formula: string
  caveat: string
}

export interface HistoryPoint {
  label: string
  value: number
}

export interface Market {
  id: MarketId
  code: string
  name: string
  exchange: string
  status: DataStatus
  updated: string
  freshness: string
  statusNote: string
  headline: string
  description: string
  metrics: Metric[]
  history?: {
    title: string
    unit: string
    points: HistoryPoint[]
    source: string
  }
}

const usdTrillion = (millions: number) => `$${(millions / 1_000_000).toFixed(3)}tn`
const usdBillions = (millions: number) => `$${(millions / 1_000).toFixed(1)}bn`
const percent = (value: number) => `${value.toFixed(1)}%`
const dateLabel = (value: string) => value.replace('-', '-')
const shareMillions = (value: number) => `${(value / 1_000_000).toFixed(1)}m`
const jpRatio = latestJP.outstandingPurchases / latestJP.outstandingSales
const jpNet = latestJP.outstandingPurchases - latestJP.outstandingSales
const freeCreditMillions = latestUS.finra.freeCashMillions + latestUS.finra.freeMarginMillions
const creditBuffer = (freeCreditMillions / latestUS.finra.debitMillions) * 100
export const latestSnapshotDate = [latestUS.refreshedAt, latestJP.refreshedAt, '2026-07-17'].sort().at(-1) ?? '—'

export const markets: Record<MarketId, Market> = {
  us: {
    id: 'us',
    code: 'US',
    name: '美国',
    exchange: 'NYSE / NASDAQ',
    status: 'verified',
    updated: latestUS.refreshedAt,
    freshness: 'FINRA 月频 · FRED 日频 / 周频',
    statusNote: 'FINRA 数据通常在参考月后第三周发布；因此保证金读数并非日频。',
    headline: '杠杆继续扩张，资金压力仍低',
    description: '保证金借方余额在 6 月创样本新高；信用利差与波动率仍处于平稳区间。两类信号频率不同，不应合并成单一交易结论。',
    metrics: [
      {
        id: 'finra-debit',
        label: '客户保证金借方余额',
        value: usdTrillion(latestUS.finra.debitMillions),
        detail: `${dateLabel(latestUS.finra.asOf)} · 月末结算日`,
        tone: 'watch',
        source: 'FINRA Margin Statistics',
        sourceUrl: 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics',
        frequency: '月频，月末结算日',
        formula: 'FINRA 会员公司客户证券保证金账户借方余额总额。',
        caveat: 'FINRA 明示统计口径可能随会员公司报告方法调整而变化；不等同于全美所有杠杆。',
      },
      {
        id: 'finra-credit-buffer',
        label: '自由贷方余额 / 借方余额',
        value: percent(creditBuffer),
        detail: `${usdBillions(freeCreditMillions)} 自由贷方余额`,
        tone: 'calm',
        source: 'FINRA Margin Statistics',
        sourceUrl: 'https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics',
        frequency: '月频，月末结算日',
        formula: '(现金账户自由贷方余额 + 保证金账户自由贷方余额) / 客户保证金借方余额。',
        caveat: '这是账户内的静态缓冲代理，并不代表市场实际可动用流动性。',
      },
      {
        id: 'us-hy-oas',
        label: '高收益债期权调整利差',
        value: `${latestUS.fred.highYieldOas.value.toFixed(2)}%`,
        detail: `${latestUS.fred.highYieldOas.asOf} · 最新交易日`,
        tone: 'calm',
        source: 'ICE BofA via FRED',
        sourceUrl: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
        frequency: '日频，交易日',
        formula: 'ICE BofA US High Yield Index Option-Adjusted Spread。',
        caveat: '利差窄说明信用融资环境偏宽松，但不直接衡量股票保证金去杠杆风险。',
      },
      {
        id: 'us-fed-assets',
        label: '联储总资产',
        value: usdTrillion(latestUS.fred.fedAssets.millions),
        detail: `${latestUS.fred.fedAssets.asOf} · 周频`,
        tone: 'calm',
        source: 'Federal Reserve via FRED',
        sourceUrl: 'https://fred.stlouisfed.org/series/WALCL',
        frequency: '周频，周三',
        formula: 'Federal Reserve Banks: Total Assets。',
        caveat: '总资产不是股市可用流动性的充分统计；请与准备金、逆回购和财政现金余额配合使用。',
      },
    ],
    history: {
      title: 'FINRA 客户保证金借方余额',
      unit: '$bn',
      source: 'FINRA · 月末结算日 · 2025-06 至 2026-06',
      points: [
        { label: '2025-06', value: 1008 },
        { label: '2025-07', value: 1023 },
        { label: '2025-08', value: 1060 },
        { label: '2025-09', value: 1126 },
        { label: '2025-10', value: 1184 },
        { label: '2025-11', value: 1214 },
        { label: '2025-12', value: 1226 },
        { label: '2026-01', value: 1279 },
        { label: '2026-02', value: 1253 },
        { label: '2026-03', value: 1221 },
        { label: '2026-04', value: 1304 },
        { label: '2026-05', value: 1416 },
        { label: '2026-06', value: 1502 },
      ],
    },
  },
  jp: {
    id: 'jp',
    code: 'JP',
    name: '日本',
    exchange: 'Tokyo Stock Exchange',
    status: 'verified',
    updated: latestJP.refreshedAt,
    freshness: 'JPX 日频 · 申请基准',
    statusNote: '当前累计值为当日发布文件中 208 个有完整买卖余额的标的求和。单位为股，不是市值。',
    headline: '融资买入显著偏多，需看价格与借券供给',
    description: '融资余额的买卖比适合观察拥挤方向，但不同股票价格差异很大，不能跨市场或跨时段直接视为杠杆金额。',
    metrics: [
      {
        id: 'jp-buy-sell',
        label: '融资买入 / 卖出余额',
        value: `${jpRatio.toFixed(2)}x`,
        detail: `${latestJP.asOf} · ${latestJP.issues} 个可计算标的`,
        tone: 'watch',
        source: 'JPX Outstanding Margin Trading by Issue',
        sourceUrl: 'https://www.jpx.co.jp/english/markets/statistics-equities/margin/index.html',
        frequency: '日频，申请基准',
        formula: '同一 JPX 文件中所有有完整值标的的 Outstanding Purchases / Outstanding Sales。',
        caveat: '以股数而非市值加总，且只覆盖该日文件中的可报告标的；不可与 FINRA 或 KOFIA 余额横向比较。',
      },
      {
        id: 'jp-purchases',
        label: '未平仓融资买入',
        value: shareMillions(latestJP.outstandingPurchases),
        detail: '股数加总 · 申请基准',
        tone: 'watch',
        source: 'JPX Outstanding Margin Trading by Issue',
        sourceUrl: 'https://www.jpx.co.jp/english/markets/statistics-equities/margin/index.html',
        frequency: '日频，申请基准',
        formula: 'JPX 文件第 12 列 Outstanding Purchases 的可用行求和。',
        caveat: '股数没有价格权重，适合方向性拥挤观察，不构成保证金融资金额。',
      },
      {
        id: 'jp-sales',
        label: '未平仓融资卖出',
        value: shareMillions(latestJP.outstandingSales),
        detail: '股数加总 · 申请基准',
        tone: 'calm',
        source: 'JPX Outstanding Margin Trading by Issue',
        sourceUrl: 'https://www.jpx.co.jp/english/markets/statistics-equities/margin/index.html',
        frequency: '日频，申请基准',
        formula: 'JPX 文件第 9 列 Outstanding Sales 的可用行求和。',
        caveat: '与买入余额同样是股数口径，不能将其理解为做空资金规模。',
      },
      {
        id: 'jp-net-long',
        label: '净多头偏向',
        value: `+${shareMillions(jpNet)}`,
        detail: '买入股数减卖出股数',
        tone: 'watch',
        source: 'JPX Outstanding Margin Trading by Issue',
        sourceUrl: 'https://www.jpx.co.jp/english/markets/statistics-equities/margin/index.html',
        frequency: '日频，申请基准',
        formula: '未平仓融资买入股数 - 未平仓融资卖出股数。',
        caveat: '方向偏好不等于隔日回报预测；应与行业集中度及融券可得性同看。',
      },
    ],
  },
  kr: {
    id: 'kr',
    code: 'KR',
    name: '韩国',
    exchange: 'KOSPI / KOSDAQ',
    status: 'review',
    updated: '2026-07-17',
    freshness: 'KOFIA 日频 · 原始导出待接入',
    statusNote: '计算已与已发布快照交叉核对；本版本尚未把 KOFIA 原始导出接入自动任务，因此禁止把此模块当作“已验证实时”。',
    headline: '信用融资偏高，但原始导出尚未自动审计',
    description: '韩国模块保留可用的核心口径与数据审计设计，但在一级数据导出自动化完成前，以橙色状态提示，避免伪精确。',
    metrics: [
      {
        id: 'kr-r2',
        label: '信用融资 / 投资者存管金',
        value: '31.28%',
        detail: '2026-07-15 · 计算已复核',
        tone: 'review',
        source: 'KOFIA FreeSIS — 신용공여 잔고 추이 / 증시자금추이',
        sourceUrl: 'https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=STATSCU0100000060',
        frequency: '日频，待一级导出接入',
        formula: '信用融资余额 / 投资者存管金。',
        caveat: '快照计算内部一致，但当前自动化链缺少可保存的 KOFIA 原始导出；请先视为待复核研究线索。',
      },
      {
        id: 'kr-fin',
        label: '信用融资余额',
        value: '₩34.37tn',
        detail: 'KOSPI ₩27.14tn · KOSDAQ ₩7.24tn',
        tone: 'review',
        source: 'KOFIA FreeSIS',
        sourceUrl: 'https://freesis.kofia.or.kr/',
        frequency: '日频，待一级导出接入',
        formula: 'KOSPI 与 KOSDAQ 信用融资余额相加。',
        caveat: '该拆分与总余额可互相校验，但尚未达到本终端的一级原始文件留档标准。',
      },
      {
        id: 'kr-deposits',
        label: '投资者存管金',
        value: '₩109.87tn',
        detail: 'R2 分母 · 2026-07-15',
        tone: 'review',
        source: 'KOFIA FreeSIS',
        sourceUrl: 'https://freesis.kofia.or.kr/',
        frequency: '日频，待一级导出接入',
        formula: 'KOFIA 公布的投资者存管金。',
        caveat: '存管金可快速波动，单日比例变化不应自动解释为新增风险偏好。',
      },
      {
        id: 'kr-liquidation',
        label: '强平 / 未收比',
        value: '3.8%',
        detail: '最新值 · 5 日强平均值 ₩62bn',
        tone: 'review',
        source: 'KOFIA FreeSIS',
        sourceUrl: 'https://freesis.kofia.or.kr/',
        frequency: '日频，待一级导出接入',
        formula: '券商强制平仓金额 / 未收余额。',
        caveat: '“爆仓阈值”并非官方标准，任何阈值都需要用原始历史样本独立回测。',
      },
    ],
  },
}

export const auditRows = [
  {
    market: '美国',
    status: 'verified' as DataStatus,
    checked: latestUS.refreshedAt,
    source: 'FINRA + FRED',
    detail: '原始页面与 CSV 可直接复取；月份与日频字段分别标注。',
  },
  {
    market: '日本',
    status: 'verified' as DataStatus,
    checked: latestJP.refreshedAt,
    source: 'JPX',
    detail: '官方日频 XLS 文件已按可计算行聚合；保留股数口径。',
  },
  {
    market: '韩国',
    status: 'review' as DataStatus,
    checked: '2026-07-17',
    source: 'KOFIA FreeSIS',
    detail: '指标公式已核对；等待一级数据导出与快照哈希进入更新链。',
  },
]
