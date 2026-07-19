import { latestJP } from './generated/latestJp'
import { latestKR } from './generated/latestKorea'
import { latestKREtf } from './generated/latestKoreaEtf'
import { latestKREtfSetred } from './generated/latestKoreaEtfSetred'
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
  meaning: string
  currentInterpretation: string
  tone: MetricTone
  source: string
  sourceUrl: string
  sourceLinks?: Array<{ label: string, url: string }>
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

export interface ChartHistory {
  title: string
  unit: string
  points: HistoryPoint[]
  source: string
  ranges?: HistoryRange[]
}

interface GearedIssuedShareChange {
  previousAsOf: string
  previousArchiveRelativePath: string
  previousArchiveUrl: string
  matchedProducts: number
  increasedProducts: number
  decreasedProducts: number
  netIssuedShares: number
  netIssuedSharesAtCurrentCloseMillions: number
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
  readingGuide: {
    title: string
    steps: Array<{ title: string, description: string }>
  }
  metrics: Metric[]
  history?: ChartHistory
  secondaryHistory?: ChartHistory
}

const usdTrillion = (millions: number) => `$${(millions / 1_000_000).toFixed(3)}tn`
const usdBillions = (millions: number) => `$${(millions / 1_000).toFixed(1)}bn`
const wonTrillion = (millions: number) => `₩${(millions / 1_000_000).toFixed(2)}tn`
const wonBillions = (millions: number) => `₩${(millions / 1_000).toFixed(1)}bn`
const wonQuadrillions = (millions: number) => `₩${(millions / 1_000_000_000).toFixed(2)}qn`
const percent = (value: number) => `${value.toFixed(1)}%`
const percentTwo = (value: number) => `${value.toFixed(2)}%`
const dateLabel = (value: string) => value.replace('-', '-')
const shareMillions = (value: number) => `${(value / 1_000_000).toFixed(1)}m`
const signedShareMillions = (value: number) => `${value >= 0 ? '+' : ''}${(value / 1_000_000).toFixed(1)}m`
const signedWonBillions = (millions: number) => `${millions >= 0 ? '+' : '-'}₩${(Math.abs(millions) / 1_000).toFixed(1)}bn`
const signedCu = (value: number) => `${value >= 0 ? '+' : ''}${value.toLocaleString()} CU`
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
const koreanCapitalAudit = {
  source: 'KOFIA FreeSIS credit supply + FSS FISIS securities-company aggregate self equity',
  sourceUrl: latestKR.fisisSourceUrl,
  sourceLinks: [
    { label: '打开 FISIS 证券公司来源', url: latestKR.fisisSourceUrl },
    { label: '打开 KOFIA 信用供与来源', url: latestKR.creditSourceUrl },
  ],
  frequency: `FISIS 季频，自有资本截至 ${latestKR.capitalCapacity.capitalAsOf}；KOFIA 信用供与日频，截至 ${latestKR.capitalCapacity.creditAsOf}`,
  snapshotHash: latestKR.sourceHash,
  snapshotArchiveUrl: latestKR.archiveUrl,
}
const koreanMarketAudit = {
  source: 'KOFIA FreeSIS daily market statistics + Naver Finance cross-check',
  sourceUrl: latestKRMarket.sourceUrl,
  frequency: `日频，${latestKRMarket.kospi.observations} 个交易日；同日 Naver 收盘差 KOSPI ${latestKRMarket.vendorCrossCheck.kospiDifference.toFixed(2)}、KOSDAQ ${latestKRMarket.vendorCrossCheck.kosdaqDifference.toFixed(2)}`,
  snapshotHash: latestKRMarket.sourceHash,
  snapshotArchiveUrl: latestKRMarket.archiveUrl,
}
const koreanValuationAudit = {
  source: 'KOFIA FreeSIS market capitalization + Bank of Korea ECOS nominal GDP',
  sourceUrl: latestKRMarket.sourceUrl,
  frequency: `日频市值 / 年频 GDP；${latestKRMarket.marketCapGdp.observations.toLocaleString()} 个同日市场观察，最新 GDP 为 ${latestKRMarket.marketCapGdp.gdpYear} 年`,
  snapshotHash: latestKRMarket.sourceHash,
  snapshotArchiveUrl: latestKRMarket.archiveUrl,
}
const koreanEtfAudit = {
  source: 'KSD SEIBro ETF product list + market summary',
  sourceUrl: latestKREtf.sourceUrl,
  frequency: '日频页面快照，产品覆盖、净资产总额与市值',
  snapshotHash: latestKREtf.sourceHash,
  snapshotArchiveUrl: latestKREtf.archiveUrl,
}
const koreanEtfSetredAudit = {
  source: 'KSD SEIBro ETF type-level setup / redemption service',
  sourceUrl: latestKREtfSetred.sourceUrl,
  frequency: `日频，${latestKREtfSetred.start} 至 ${latestKREtfSetred.asOf} · ${latestKREtfSetred.observations.toLocaleString()} 个有效交易日`,
  snapshotHash: latestKREtfSetred.sourceHash,
  snapshotArchiveUrl: latestKREtfSetred.archiveUrl,
}
const gearedIssuedShareChange = latestKREtf.gearedIssuedShareChange as GearedIssuedShareChange | null
const japanAudit = {
  snapshotHash: latestJP.sourceHash,
  snapshotArchiveUrl: latestJP.archiveUrl,
}

export const latestSnapshotDate = [latestUS.refreshedAt, latestJP.refreshedAt, latestKR.refreshedAt, latestKRMarket.refreshedAt, latestKREtf.refreshedAt, latestKREtfSetred.refreshedAt].sort().at(-1) ?? '—'
const latestKoreanVerifiedDate = [latestKR.asOf, latestKRMarket.refreshedAt, latestKREtf.refreshedAt, latestKREtfSetred.refreshedAt].sort().at(-1) ?? latestKR.asOf

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
    readingGuide: {
      title: '从仓位到融资环境',
      steps: [
        { title: '先看保证金借方余额', description: '它回答“账户借了多少证券融资”。先判断杠杆规模，再看风险是否正在兑现。' },
        { title: '再看账户内缓冲', description: '自由贷方余额相对借方余额，反映静态缓冲；不是可立即动用的全市场现金。' },
        { title: '最后看利差与联储资产', description: '它们提供融资环境背景，不能替代股票保证金风险本身。' },
      ],
    },
    metrics: [
      {
        id: 'finra-debit',
        label: '客户保证金借方余额',
        value: usdTrillion(latestUS.finra.debitMillions),
        detail: `${dateLabel(latestUS.finra.asOf)} · 月末结算日`,
        meaning: 'FINRA 会员公司客户保证金账户中，借来买证券的余额总额。它衡量的是显性股票杠杆规模。',
        currentInterpretation: '6 月读数处于样本高位，说明显性保证金借款仍在扩张；但这是月度数据，不代表今天的仓位变化。',
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
        meaning: '客户自由贷方余额相对于保证金借方余额的比例，可视为账户内静态现金缓冲代理。',
        currentInterpretation: `当前每 $1 保证金借方余额对应约 $${(creditBuffer / 100).toFixed(2)} 的自由贷方余额；缓冲不等于市场随时可用的流动性。`,
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
        meaning: '高收益债相对无风险利率的期权调整利差，观察信用融资环境是否在收紧。',
        currentInterpretation: '当前利差仍偏窄，信用融资环境没有显示明显压力；它不能直接推断股票保证金会不会被动去杠杆。',
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
        meaning: '联邦储备银行资产负债表总规模，是宏观流动性背景之一。',
        currentInterpretation: '当前读数只说明周度资产存量；不能单独解读为股市的可用资金或即时风险信号。',
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
    readingGuide: {
      title: '先看方向，再看金额局限',
      steps: [
        { title: '先看买入 / 卖出余额比', description: '它提示融资仓位更偏多还是偏空，不代表买卖双方金额。' },
        { title: '再看未平仓绝对股数', description: '确认偏向由哪一侧的存量驱动，但不同股票价格差异不会被这个指标反映。' },
        { title: '最后结合价格与借券供给', description: '融资仓位不是收益预测，仍需回到个股、行业和借券可得性。' },
      ],
    },
    metrics: [
      {
        id: 'jp-buy-sell',
        label: '融资买入 / 卖出余额',
        value: `${jpRatio.toFixed(2)}x`,
        detail: `${latestJP.asOf} · ${latestJP.issues} 个可计算标的`,
        meaning: '同一份 JPX 文件中的未平仓融资买入股数除以融资卖出股数，用来观察融资仓位的方向偏向。',
        currentInterpretation: `当前买入余额约为卖出余额的 ${jpRatio.toFixed(2)} 倍，说明样本中的融资仓位偏多；它不是按市值计算。`,
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
        meaning: 'JPX 文件内有完整值标的的未平仓融资买入股数之和。',
        currentInterpretation: '当前是融资多头存量的股数尺度；股票价格没有权重，不能把它当作融资金额。',
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
        meaning: 'JPX 文件内有完整值标的的未平仓融资卖出股数之和。',
        currentInterpretation: '当前是融资卖出存量的股数尺度，适合与买入余额一起看方向，不能推断实际做空资金。',
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
        meaning: '未平仓融资买入股数减去融资卖出股数，概括样本中的净多头股数偏向。',
        currentInterpretation: `当前净偏向为 ${shareMillions(jpNet)} 的买入股数；这描述存量方向，不预测下一交易日收益。`,
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
    readingGuide: {
      title: '先看压力，再看杠杆',
      steps: [
        { title: '先看强平是否在兑现', description: '5 日强平金额和强平/未收额最接近被动卖出压力；先确认风险有没有转为实际卖盘。' },
        { title: '再看融资与资本位置', description: 'R2 看显性融资相对场边现金，信用供与/自有资本看更广信用相对会计资本；两者不能相加。' },
        { title: '最后看 ETF 与市场背景', description: 'ETF 设置/赎回 CU、指数、估值和外资持股用于补充背景，不应单独变成交易结论。' },
      ],
    },
    metrics: [
      {
        id: 'kr-r2',
        label: '信用融资 / 投资者存管金',
        value: percentTwo(krMarginToDeposits),
        detail: `10年 ${percentTwo(latestKR.statistics.r2TenYearPercentile)} 分位 · ${latestKR.statistics.r2TenYearObservations.toLocaleString()} 日`,
        meaning: '信用交易融资余额相对于投资者存管金，观察显性融资杠杆与场边现金之间的比例。',
        currentInterpretation: `当前处于近 10 年 ${percentTwo(latestKR.statistics.r2TenYearPercentile)} 分位，显性融资相对存管金不在历史高位；存管金短期变动会放大该比例。`,
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
        meaning: '券商强制平仓卖出金额的最近 5 个有效交易日平均值，观察杠杆风险是否已经转为实际卖盘。',
        currentInterpretation: `当前处于近 10 年 ${percentTwo(latestKR.statistics.forcedLiquidationTenYearPercentile)} 分位，近期被动卖出金额异常偏高；它不等同于所有保证金追缴或全市场损失。`,
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
        meaning: 'KOFIA 公布的“未收额 대비 实际反对卖出金额”比例，描述当日强平相对未收额的公开口径。',
        currentInterpretation: `当前为 ${percentTwo(latestKR.forcedLiquidationToUnpaidPercent)}，低于近期高压日；10% 不是官方爆仓阈值，不能把它当作硬警报线。`,
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
        meaning: '信用融资、大株、申购贷款和担保融资合计相对于投资者存管金，观察比 R2 更宽的信用供与范围。',
        currentInterpretation: `当前每 ₩1 存管金对应约 ₩${(krTotalCreditToDeposits / 100).toFixed(2)} 的广义信用供与；它包含 R2 的分子，不能与 R2 当成两份独立杠杆相加。`,
        tone: 'watch',
        ...koreanAudit,
        formula: '信用交易融资 + 信用交易大株 + 申购资金贷款 + 证券担保融资，除以投资者存管金。',
        caveat: '较“信用融资”覆盖范围更广，不应把两者视为可相加的独立杠杆信号。',
      },
      {
        id: 'kr-capital-capacity',
        label: '信用供与 / 券商自有资本',
        value: percentTwo(latestKR.capitalCapacity.capitalCapacityPercent),
        detail: `10年 ${percentTwo(latestKR.capitalCapacity.statistics.tenYearPercentile)} 分位 · FISIS ${latestKR.capitalCapacity.capitalAsOf} ${wonTrillion(latestKR.capitalCapacity.securitiesEquityMillions)}`,
        meaning: 'KOFIA 广义信用供与相对于 FSS FISIS 证券公司汇总自有资本的会计资本容量代理。',
        currentInterpretation: `当前处于可匹配季度样本的 ${percentTwo(latestKR.capitalCapacity.statistics.tenYearPercentile)} 分位，广义信用相对会计资本偏高；它不是监管净资本比率或法定额度利用率。`,
        tone: percentileTone(latestKR.capitalCapacity.statistics.tenYearPercentile),
        ...koreanCapitalAudit,
        formula: 'KOFIA 当日信用交易融资、信用交易大株、申购资金贷款及证券担保融资之和，除以 FSS FISIS“证券公司”汇总“自有资本”。历史位置以各季度末可匹配的 KOFIA 交易日计算。',
        caveat: `分子截至 ${latestKR.capitalCapacity.creditAsOf}，分母截至 ${latestKR.capitalCapacity.capitalAsOf}。这是观察信用供与相对会计资本的容量代理，不是法定净资本比率、监管额度利用率，也不保证两份报表的机构范围完全相同。`,
      },
      {
        id: 'kr-kospi-close',
        label: 'KOSPI 收盘价',
        value: latestKRMarket.kospi.close.toFixed(2),
        detail: `${latestKRMarket.kospi.asOf} · 区间 ${latestKRMarket.kospi.trailingReturnPercent >= 0 ? '+' : ''}${latestKRMarket.kospi.trailingReturnPercent.toFixed(1)}%`,
        meaning: 'KOFIA 公布的 KOSPI 日别指数，用作杠杆与流动性读数的市场背景。',
        currentInterpretation: `当前显示区间 ${latestKRMarket.kospi.trailingReturnPercent >= 0 ? '+' : ''}${latestKRMarket.kospi.trailingReturnPercent.toFixed(1)}% 的变化；它帮助定位市场阶段，不是可执行价格或单独的风险评分。`,
        tone: 'calm',
        ...koreanMarketAudit,
        formula: 'KOFIA FreeSIS“유가증권시장”日别序列的当日指数；区间回报为最新值相对序列首日的变化。最新值要求与 Naver Finance 指数接口同日一致。',
        caveat: 'KOFIA 和 Naver 都不是 KRX 原始结算文件；两方一致只证明公开发布值未出现可检测差异。它用于杠杆读数的市场背景，不能替代可交易价格或官方结算价。',
      },
      {
        id: 'kr-kosdaq-close',
        label: 'KOSDAQ 收盘价',
        value: latestKRMarket.kosdaq.close.toFixed(2),
        detail: `${latestKRMarket.kosdaq.asOf} · 区间 ${latestKRMarket.kosdaq.trailingReturnPercent >= 0 ? '+' : ''}${latestKRMarket.kosdaq.trailingReturnPercent.toFixed(1)}%`,
        meaning: 'KOFIA 公布的 KOSDAQ 日别指数，用作成长股与中小盘市场背景。',
        currentInterpretation: `当前显示区间 ${latestKRMarket.kosdaq.trailingReturnPercent >= 0 ? '+' : ''}${latestKRMarket.kosdaq.trailingReturnPercent.toFixed(1)}% 的变化；应与 KOSPI 和信用读数一起读，不替代交易价格。`,
        tone: 'calm',
        ...koreanMarketAudit,
        formula: 'KOFIA FreeSIS“코스닥시장”日别序列的当日指数；区间回报为最新值相对序列首日的变化。最新值要求与 Naver Finance 指数接口同日一致。',
        caveat: 'KOFIA 和 Naver 都不是 KRX 原始结算文件；两方一致只证明公开发布值未出现可检测差异。它用于杠杆读数的市场背景，不能替代可交易价格或官方结算价。',
      },
      {
        id: 'kr-market-cap-gdp',
        label: '韩国股市总市值 / 名义 GDP',
        value: percentTwo(latestKRMarket.marketCapGdp.percent),
        detail: `KOSPI + KOSDAQ · 10年 ${percentTwo(latestKRMarket.marketCapGdp.tenYearPercentile)} 分位 · GDP ${latestKRMarket.marketCapGdp.gdpYear}`,
        meaning: 'KOSPI 与 KOSDAQ 同日市值之和相对于韩国最新完整年度名义 GDP，观察市场规模的历史位置。',
        currentInterpretation: `当前处于近 10 年 ${percentTwo(latestKRMarket.marketCapGdp.tenYearPercentile)} 分位，市场规模相对年度 GDP 偏高；它不是盈利估值、风险溢价或收益预测。`,
        tone: percentileTone(latestKRMarket.marketCapGdp.tenYearPercentile),
        ...koreanValuationAudit,
        sourceLinks: [
          { label: '打开 KOFIA 市值来源', url: latestKRMarket.kofiaSources.kospi },
          { label: '打开 BOK GDP 来源', url: latestKRMarket.bokSources.nominalGdp },
        ],
        formula: 'KOFIA 当日 KOSPI 市值 + KOSDAQ 市值，除以韩国央行 ECOS“名义 GDP（韩元）”的最新完整年度值。历史分位仅使用两个市场均有记录的同日交集。',
        caveat: `当前总市值 ${wonQuadrillions(latestKRMarket.marketCapGdp.totalMarketCapMillions)}，分母为 ${latestKRMarket.marketCapGdp.gdpYear} 年 GDP ${wonQuadrillions(latestKRMarket.marketCapGdp.gdpBillions * 1_000)}。市值按日变动而 GDP 年度发布且可能修订；该比例不是盈利估值、风险溢价或收益预测。`,
      },
      {
        id: 'kr-kospi-foreign-ownership',
        label: 'KOSPI 外资持股市值占比',
        value: percentTwo(latestKRMarket.kospi.foreignMarketCapPercent),
        detail: `外资市值 ${wonQuadrillions(latestKRMarket.kospi.foreignMarketCapMillions)} · ${latestKRMarket.kospi.asOf}`,
        meaning: '外资持有的 KOSPI 股票市值占 KOSPI 总市值的比例，衡量存量持股结构。',
        currentInterpretation: `当前外资持股市值占比为 ${percentTwo(latestKRMarket.kospi.foreignMarketCapPercent)}；它不代表当日外资净买卖、可自由流通比例或风险偏好变化。`,
        tone: 'calm',
        source: 'KOFIA FreeSIS 유가증권시장',
        sourceUrl: latestKRMarket.kofiaSources.kospi,
        frequency: '日频，交易日',
        snapshotHash: latestKRMarket.sourceHash,
        snapshotArchiveUrl: latestKRMarket.archiveUrl,
        formula: 'KOFIA“유가증권시장”日别表公布的外资市值 / 总市值比例（TMPV7）。',
        caveat: '持股市值占比衡量存量，而非当日买卖流、可自由流通比例或外资风险偏好；它不能替代按投资者类别统计的净买卖数据。',
      },
      {
        id: 'kr-geared-etf-net-setred-cu',
        label: '杠杆 / 反向 ETF 净设赎',
        value: signedCu(latestKREtfSetred.latest.leveragedNetCu + latestKREtfSetred.latest.inverseNetCu),
        detail: `KSD ${latestKREtfSetred.asOf} · 杠杆 ${signedCu(latestKREtfSetred.latest.leveragedNetCu)} · 反向 ${signedCu(latestKREtfSetred.latest.inverseNetCu)}`,
        meaning: 'KSD 分类下杠杆与反向 ETF 的设置 CU 减赎回 CU，观察这两类产品的申赎单位变化。',
        currentInterpretation: `最新基准日两类合计为 ${signedCu(latestKREtfSetred.latest.leveragedNetCu + latestKREtfSetred.latest.inverseNetCu)}；CU 不是金额或资金净流，不能直接推断多空资金方向。`,
        tone: 'review',
        ...koreanEtfSetredAudit,
        formula: 'KSD SEIBro “레버리지”(P0101) 与 “인버스”(P0201) 的设置 CU 减赎回 CU，再加总两类结果。',
        caveat: 'CU 是 ETF 的设置/赎回单位，不能折算或命名为资金净流。产品类型为 KSD 页面所载 FnGuide 分类；总发行份额、净资产等辅助字段为前一日口径。',
      },
      {
        id: 'kr-geared-etf-net-assets',
        label: '杠杆 / 反向 ETF 净资产',
        value: wonTrillion(latestKREtf.gearedNetAssetsMillions),
        detail: `${latestKREtf.gearedProducts} 只：杠杆 ${latestKREtf.leveragedProducts} · 反向 ${latestKREtf.inverseProducts}`,
        meaning: 'KSD 市场汇总中所有杠杆与反向 ETF 的公布净资产总额之和，衡量产品集合规模。',
        currentInterpretation: `当前覆盖 ${latestKREtf.gearedProducts} 只产品，集合规模为 ${wonTrillion(latestKREtf.gearedNetAssetsMillions)}；覆盖含股票、海外、商品和利率等产品，不等于散户实际风险敞口。`,
        tone: 'review',
        ...koreanEtfAudit,
        formula: '对 KSD SEIBro ETF 市场汇总中“레버리지”与“인버스”类别逐只取公布的“순자산총액”（单位：百万韩元）后求和。',
        caveat: '净资产总额比场内市值更接近基金资产规模，但仍不等于净申赎、持仓杠杆倍数或散户实际风险敞口。该覆盖包括股票、海外、商品和利率等所有杠杆/反向 ETF。',
      },
      {
        id: 'kr-geared-etf-premium',
        label: '杠杆 / 反向 ETF 场内溢折价',
        value: percentTwo(latestKREtf.gearedOfficialMarketPremiumPercent),
        detail: `市值 ${wonTrillion(latestKREtf.gearedOfficialMarketCapMillions)} · 对净资产`,
        meaning: '同一组杠杆与反向 ETF 的公布市值相对公布净资产总额的集合偏离。',
        currentInterpretation: `当前集合偏离为 ${percentTwo(latestKREtf.gearedOfficialMarketPremiumPercent)}，整体价格与净资产接近；它不能替代任何单只 ETF 的可交易溢折价。`,
        tone: 'review',
        ...koreanEtfAudit,
        formula: 'KSD SEIBro 市场汇总中相同产品集合的“시가총액 / 순자산총액 - 1”。',
        caveat: '这是产品集合加总后的价格相对净资产偏离，不代表单只 ETF 的可交易溢折价，也不是资金申赎或多空方向信号。',
      },
      ...(gearedIssuedShareChange ? [{
        id: 'kr-geared-etf-issued-shares',
        label: '杠杆 / 反向 ETF 发行份额变动',
        value: signedShareMillions(gearedIssuedShareChange.netIssuedShares),
        detail: `较 ${gearedIssuedShareChange.previousAsOf} · 按最新收盘折算 ${signedWonBillions(gearedIssuedShareChange.netIssuedSharesAtCurrentCloseMillions)}`,
        meaning: '相同产品在两个不同基准日之间的总发行份额变化，观察存量份额是否变化。',
        currentInterpretation: `当前比较 ${gearedIssuedShareChange.matchedProducts} 只匹配产品，增加 ${gearedIssuedShareChange.increasedProducts} 只、减少 ${gearedIssuedShareChange.decreasedProducts} 只；拆分、合并、上市或下市同样会影响这个数。`,
        tone: 'review' as MetricTone,
        ...koreanEtfAudit,
        formula: `KSD 连续两个不同基准日快照中 ${gearedIssuedShareChange.matchedProducts} 只相同产品的“总发行股数”相减后求和。`,
        caveat: `增加 ${gearedIssuedShareChange.increasedProducts} 只、减少 ${gearedIssuedShareChange.decreasedProducts} 只。该指标是发行份额变化，不是资金净申赎；拆分、合并、上市或下市等公司行为可能改变份额。`,
      }] : []),
    ],
    history: {
      title: 'R2：信用融资 / 投资者存管金',
      unit: '%',
      source: `KOFIA FreeSIS · 日频 · ${latestKR.statistics.start} 至 ${latestKR.asOf} · ${latestKR.statistics.observations.toLocaleString()} 个有效交易日 · 原始响应已归档`,
      ranges: ['1Y', '5Y', '10Y', '全部'],
      points: latestKR.history.map((point) => ({ label: point.asOf, value: point.r2Percent })),
    },
    secondaryHistory: {
      title: '韩国股市总市值 / 名义 GDP',
      unit: '%',
      source: `KOFIA KOSPI + KOSDAQ 日频市值 / 韩国央行 ECOS ${latestKRMarket.marketCapGdp.gdpYear} 年名义 GDP · ${latestKRMarket.marketCapGdp.observations.toLocaleString()} 个同日市场观察`,
      ranges: ['1Y', '5Y', '10Y'],
      points: latestKRMarket.marketCapGdp.history.map((point) => ({ label: point.asOf, value: point.marketCapToGdpPercent })),
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
    checked: latestKoreanVerifiedDate,
    source: 'KOFIA + FSS FISIS + BOK ECOS + KSD SEIBro + Naver cross-check',
    detail: `杠杆历史截至 ${latestKR.asOf}；券商自有资本截至 ${latestKR.capitalCapacity.capitalAsOf}；ETF 设置/赎回 CU 截至 ${latestKREtfSetred.asOf}，ETF 规模与市场参照截至 ${[latestKRMarket.refreshedAt, latestKREtf.refreshedAt].sort().at(-1)}。KOFIA JSON、FISIS 季度响应、BOK GDP、KSD 页面与另一公开行情接口的交叉校验均已归档；${latestKR.sourceHash.slice(0, 19)}…`,
  },
]
