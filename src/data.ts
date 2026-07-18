import { latestJP } from './generated/latestJp'
import { latestKR } from './generated/latestKorea'
import { latestKREtf } from './generated/latestKoreaEtf'
import { latestKRMarket } from './generated/latestKoreaMarket'
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
  snapshotHash?: string
  snapshotArchiveUrl?: string
}

export interface HistoryPoint {
  label: string
  value: number
}

export type HistoryRange = '1Y' | '5Y' | '10Y' | '全部'

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
    ranges?: HistoryRange[]
  }
}

const usdTrillion = (millions: number) => `$${(millions / 1_000_000).toFixed(3)}tn`
const usdBillions = (millions: number) => `$${(millions / 1_000).toFixed(1)}bn`
const wonTrillion = (millions: number) => `₩${(millions / 1_000_000).toFixed(2)}tn`
const wonBillions = (millions: number) => `₩${(millions / 1_000).toFixed(1)}bn`
const percent = (value: number) => `${value.toFixed(1)}%`
const percentTwo = (value: number) => `${value.toFixed(2)}%`
const dateLabel = (value: string) => value.replace('-', '-')
const shareMillions = (value: number) => `${(value / 1_000_000).toFixed(1)}m`
const jpRatio = latestJP.outstandingPurchases / latestJP.outstandingSales
const jpNet = latestJP.outstandingPurchases - latestJP.outstandingSales
const freeCreditMillions = latestUS.finra.freeCashMillions + latestUS.finra.freeMarginMillions
const creditBuffer = (freeCreditMillions / latestUS.finra.debitMillions) * 100
const krMarginToDeposits = (latestKR.marginCreditMillions / latestKR.investorDepositsMillions) * 100
const krTotalCreditToDeposits = (latestKR.totalCreditSupplyMillions / latestKR.investorDepositsMillions) * 100
const percentileTone = (value: number): MetricTone => value >= 95 ? 'stress' : value >= 75 ? 'watch' : 'calm'
const koreanAudit = {
  source: 'KOFIA FreeSIS — 증시자금추이 / 신용공여 잔고 추이',
  sourceUrl: latestKR.sourceUrl,
  frequency: `日频，${latestKR.statistics.start} 至 ${latestKR.asOf}`,
  snapshotHash: latestKR.sourceHash,
  snapshotArchiveUrl: latestKR.archiveUrl,
}
const koreanMarketAudit = {
  source: 'Naver Finance KRX index feed',
  sourceUrl: latestKRMarket.sourceUrl,
  frequency: '最新收盘价；约一年周频历史采样，公开行情供应商',
  snapshotHash: latestKRMarket.sourceHash,
  snapshotArchiveUrl: latestKRMarket.archiveUrl,
}
const koreanEtfAudit = {
  source: 'KSD SEIBro ETF product list',
  sourceUrl: latestKREtf.sourceUrl,
  frequency: '日频页面快照，产品覆盖与分类',
  snapshotHash: latestKREtf.sourceHash,
  snapshotArchiveUrl: latestKREtf.archiveUrl,
}
const japanAudit = {
  snapshotHash: latestJP.sourceHash,
  snapshotArchiveUrl: latestJP.archiveUrl,
}

export const latestSnapshotDate = [latestUS.refreshedAt, latestJP.refreshedAt, latestKR.refreshedAt, latestKRMarket.refreshedAt, latestKREtf.refreshedAt].sort().at(-1) ?? '—'

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
      source: `FINRA · 月末结算日 · ${latestUS.finra.history[0]?.asOf ?? '—'} 至 ${latestUS.finra.asOf}`,
      points: latestUS.finra.history.map((point) => ({ label: point.asOf, value: point.debitMillions / 1_000 })),
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
        ...japanAudit,
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
        ...japanAudit,
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
        ...japanAudit,
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
        ...japanAudit,
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
    status: 'verified',
    updated: latestKR.asOf,
    freshness: `KOFIA 日频 · ${latestKR.statistics.observations.toLocaleString()} 个有效交易日`,
    statusNote: '资金、强平与信用供与两条官方日序列逐日交集校验；零值占位不进入比率或分位。原始响应按基准日归档并记录 SHA-256。',
    headline: '杠杆位置可量化，强平压力单独观察',
    description: 'R2、信用供与和强制平仓衡量的是不同机制。页面显示各自的 10 年历史位置，不把它们压缩成黑箱交易分数。',
    metrics: [
      {
        id: 'kr-r2',
        label: '信用融资 / 投资者存管金',
        value: percentTwo(krMarginToDeposits),
        detail: `10年 ${percentTwo(latestKR.statistics.r2TenYearPercentile)} 分位 · ${latestKR.statistics.r2TenYearObservations.toLocaleString()} 日`,
        tone: percentileTone(latestKR.statistics.r2TenYearPercentile),
        ...koreanAudit,
        formula: 'KOFIA 信用交易融资余额 / KOFIA 投资者存管金；分位使用最近 2,520 个有效交易日中小于等于当前值的比例。',
        caveat: '两项均是余额，并非可立即动用的现金；存管金的短期波动可能放大该比率变化。',
      },
      {
        id: 'kr-liquidation-average',
        label: '强制平仓金额（5日均）',
        value: wonBillions(latestKR.statistics.forcedLiquidationFiveDayAverageMillions),
        detail: `10年 ${percentTwo(latestKR.statistics.forcedLiquidationTenYearPercentile)} 分位 · 最新 ${wonBillions(latestKR.forcedLiquidationMillions)}`,
        tone: percentileTone(latestKR.statistics.forcedLiquidationTenYearPercentile),
        ...koreanAudit,
        formula: 'KOFIA “미수금 대비 실제 반대매매금액”最近 5 个有效交易日的算术均值；分位基于 10 年内全部滚动 5 日均值。',
        caveat: '这是实际反对卖出金额，不是所有账户的保证金追缴金额；早期未覆盖期以零值呈现，不进入当前 10 年分位。',
      },
      {
        id: 'kr-liquidation-ratio',
        label: '强平 / 未收额（最新）',
        value: percentTwo(latestKR.forcedLiquidationToUnpaidPercent),
        detail: `强平 ${wonBillions(latestKR.forcedLiquidationMillions)} · 未收额 ${wonTrillion(latestKR.unpaidReceivablesMillions)}`,
        tone: latestKR.forcedLiquidationToUnpaidPercent >= 10 ? 'stress' : latestKR.forcedLiquidationToUnpaidPercent >= 5 ? 'watch' : 'calm',
        ...koreanAudit,
        formula: 'KOFIA 历史表字段 TMPV7：“미수금 대비 실제 반대매매금액”公布比例。',
        caveat: 'KOFIA 的该公布比例在部分历史日期不等于页面展示金额相除，故页面不自行反算或替换其定义。10% 不是官方“爆仓阈值”，不可外推为全市场损失。',
      },
      {
        id: 'kr-total-credit',
        label: '信用供与总额 / 投资者存管金',
        value: percentTwo(krTotalCreditToDeposits),
        detail: `总额 ${wonTrillion(latestKR.totalCreditSupplyMillions)} · 融资 ${wonTrillion(latestKR.marginCreditMillions)}`,
        tone: 'watch',
        ...koreanAudit,
        formula: '信用交易融资 + 信用交易大株 + 申购资金贷款 + 证券担保融资，除以投资者存管金。',
        caveat: '较“信用融资”覆盖范围更广，不应把两者视为可相加的独立杠杆信号。',
      },
      {
        id: 'kr-kospi-close',
        label: 'KOSPI 收盘价',
        value: latestKRMarket.kospi.close.toFixed(2),
        detail: `${latestKRMarket.kospi.asOf} · 区间 ${latestKRMarket.kospi.trailingReturnPercent >= 0 ? '+' : ''}${latestKRMarket.kospi.trailingReturnPercent.toFixed(1)}%`,
        tone: 'review',
        ...koreanMarketAudit,
        formula: 'Naver Finance KRX 指数接口返回的 KOSPI 当期 closePrice；区间回报为最新值相对接口首个可用收盘价的变化。',
        caveat: '这是公开行情供应商转发的 KRX 指数行情，并非 KRX 原始文件。它用于杠杆读数的市场背景，不能替代可交易价格或官方结算价。',
      },
      {
        id: 'kr-kosdaq-close',
        label: 'KOSDAQ 收盘价',
        value: latestKRMarket.kosdaq.close.toFixed(2),
        detail: `${latestKRMarket.kosdaq.asOf} · 区间 ${latestKRMarket.kosdaq.trailingReturnPercent >= 0 ? '+' : ''}${latestKRMarket.kosdaq.trailingReturnPercent.toFixed(1)}%`,
        tone: 'review',
        ...koreanMarketAudit,
        formula: 'Naver Finance KRX 指数接口返回的 KOSDAQ 当期 closePrice；区间回报为最新值相对接口首个可用收盘价的变化。',
        caveat: '这是公开行情供应商转发的 KRX 指数行情，并非 KRX 原始文件。它用于杠杆读数的市场背景，不能替代可交易价格或官方结算价。',
      },
      {
        id: 'kr-geared-etf-value',
        label: '杠杆 / 反向 ETF 市值代理',
        value: wonTrillion(latestKREtf.gearedMarketValueWon / 1_000_000),
        detail: `${latestKREtf.gearedProducts} 只：杠杆 ${latestKREtf.leveragedProducts} · 反向 ${latestKREtf.inverseProducts}`,
        tone: 'review',
        ...koreanEtfAudit,
        formula: '对 KSD SEIBro 产品表中“레버리지”与“인버스”类别逐只取“总发行股数 × 收盘价”后求和。',
        caveat: '这是基于交易所收盘价和总发行股数的市值代理，不等于 ETF NAV、资产管理规模、净申赎、持仓杠杆或散户实际敞口。',
      },
    ],
    history: {
      title: 'R2：信用融资 / 投资者存管金',
      unit: '%',
      source: `KOFIA FreeSIS · 日频 · ${latestKR.statistics.start} 至 ${latestKR.asOf} · ${latestKR.statistics.observations.toLocaleString()} 个有效交易日 · 原始响应已归档`,
      ranges: ['1Y', '5Y', '10Y', '全部'],
      points: latestKR.history.map((point) => ({ label: point.asOf, value: point.r2Percent })),
    },
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
    detail: `官方日频 XLS 已归档并校验可计算行；${latestJP.sourceHash.slice(0, 19)}…`,
  },
  {
    market: '韩国',
    status: 'verified' as DataStatus,
    checked: latestKR.asOf,
    source: 'KOFIA + KSD SEIBro + Naver Finance',
    detail: `KOFIA 官方 JSON、KSD ETF 页面与 KRX 指数供应商响应均已归档；${latestKR.sourceHash.slice(0, 19)}…`,
  },
]
