/**
 * Build an auditable Korean leverage history from KOFIA FreeSIS.
 *
 * The two historical KOFIA tables are queried directly with the same payload
 * their public UI sends. We require identical funding and credit date sets,
 * remove KOFIA's historical zero placeholders from derived observations, and
 * persist the full source response before publishing derived metrics.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const HISTORY_ENDPOINT = 'https://freesis.kofia.or.kr/meta/getMetaDataList.do'
const FUNDING_SERVICE = 'STATSCU0100000060BO'
const CREDIT_SERVICE = 'STATSCU0100000070BO'
const SOURCE_URL = 'https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=STATSCU0100000060'
const CREDIT_SOURCE_URL = 'https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=STATSCU0100000070'
const HISTORY_START = '19980701'
const TEN_YEAR_TRADING_DAYS = 2_520
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath = process.env.KOFIA_CHROME_PATH || (existsSync(localChrome) ? localChrome : undefined)
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const page = await browser.newPage()
await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 60_000 })

function toIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) {
    throw new Error(`KOFIA supplied an invalid reference date: ${String(value)}`)
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function numeric(value, label) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`KOFIA field ${label} was not numeric`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`KOFIA field ${label} was not a non-negative number`)
  }
  return parsed
}

function percentileAtOrBelow(values, value) {
  const usable = values.filter((candidate) => Number.isFinite(candidate))
  if (!usable.length) throw new Error('Cannot calculate a percentile without observations')
  return (usable.filter((candidate) => candidate <= value).length / usable.length) * 100
}

function rollingAverage(values, window) {
  if (values.length < window) return []
  let sum = 0
  return values.map((value, index) => {
    sum += value
    if (index >= window) sum -= values[index - window]
    return index >= window - 1 ? sum / window : null
  }).filter((value) => value !== null)
}

async function fetchJson(url, body, sourceName) {
  // KOFIA's web firewall rejects server-side HTTP fingerprints intermittently.
  // Use the same browser-origin fetch path as the public FreeSIS UI.
  const response = await page.evaluate(async ({ requestUrl, requestBody }) => {
    const result = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    return { status: result.status, raw: await result.text() }
  }, { requestUrl: url, requestBody: body })
  if (response.status !== 200) throw new Error(`${sourceName} request failed with HTTP ${response.status}`)
  const { raw } = response
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(`${sourceName} did not return JSON: ${raw.slice(0, 120).replaceAll('\n', ' ')}`)
  }
  return { raw, payload }
}

function historyRequest(service, endDate) {
  return {
    dmSearch: {
      tmpV40: '1000000',
      tmpV41: '1',
      tmpV1: 'D',
      tmpV45: HISTORY_START,
      tmpV46: endDate.replaceAll('-', ''),
      OBJ_NM: service,
    },
  }
}

const queryEnd = new Date().toISOString().slice(0, 10)
const fundingResult = await fetchJson(HISTORY_ENDPOINT, historyRequest(FUNDING_SERVICE, queryEnd), 'KOFIA funding history')
const creditResult = await fetchJson(HISTORY_ENDPOINT, historyRequest(CREDIT_SERVICE, queryEnd), 'KOFIA credit history')

if (!Array.isArray(fundingResult.payload?.ds1) || !Array.isArray(creditResult.payload?.ds1)) {
  throw new Error('KOFIA history response did not contain the expected ds1 table')
}

const fundingByDate = new Map()
for (const row of fundingResult.payload.ds1) {
  const rawDate = String(row.TMPV1)
  const date = toIsoDate(rawDate)
  if (fundingByDate.has(date)) throw new Error(`KOFIA funding history duplicated ${date}`)
  fundingByDate.set(date, {
    investorDepositsMillions: numeric(row.TMPV2, `funding deposits ${rawDate}`),
    derivativeDepositsMillions: numeric(row.TMPV3, `derivatives deposits ${rawDate}`),
    clientRpSalesMillions: numeric(row.TMPV4, `client RP sales ${rawDate}`),
    unpaidReceivablesMillions: numeric(row.TMPV5, `unpaid receivables ${rawDate}`),
    forcedLiquidationMillions: numeric(row.TMPV6, `forced liquidation ${rawDate}`),
    forcedLiquidationToUnpaidPercent: numeric(row.TMPV7, `forced liquidation ratio ${rawDate}`),
  })
}

const creditByDate = new Map()
for (const row of creditResult.payload.ds1) {
  const rawDate = String(row.TMPV1)
  const date = toIsoDate(rawDate)
  if (creditByDate.has(date)) throw new Error(`KOFIA credit history duplicated ${date}`)
  const marginCreditMillions = numeric(row.TMPV2, `margin credit ${rawDate}`)
  const creditShortMillions = numeric(row.TMPV5, `credit short ${rawDate}`)
  const subscriptionLoanMillions = numeric(row.TMPV8, `subscription loan ${rawDate}`)
  const collateralLoanMillions = numeric(row.TMPV9, `collateral loan ${rawDate}`)
  creditByDate.set(date, {
    marginCreditMillions,
    kospiMarginCreditMillions: numeric(row.TMPV3, `KOSPI margin credit ${rawDate}`),
    kosdaqMarginCreditMillions: numeric(row.TMPV4, `KOSDAQ margin credit ${rawDate}`),
    creditShortMillions,
    subscriptionLoanMillions,
    collateralLoanMillions,
    totalCreditSupplyMillions: marginCreditMillions + creditShortMillions + subscriptionLoanMillions + collateralLoanMillions,
  })
}

if (fundingByDate.size !== creditByDate.size) {
  throw new Error(`KOFIA histories have different observation counts: ${fundingByDate.size} funding vs ${creditByDate.size} credit`)
}
for (const date of creditByDate.keys()) {
  if (!fundingByDate.has(date)) throw new Error(`KOFIA funding history is missing ${date}`)
}

const history = [...fundingByDate.keys()].sort().map((date) => {
  const funding = fundingByDate.get(date)
  const credit = creditByDate.get(date)
  if (!credit) throw new Error(`KOFIA credit history is missing ${date}`)
  // KOFIA retains a small number of historical zero placeholders. They are not
  // observations and must not enter ratios, historical charts, or percentiles.
  if (funding.investorDepositsMillions === 0 || credit.marginCreditMillions === 0) return null
  const r2Percent = (credit.marginCreditMillions / funding.investorDepositsMillions) * 100
  // Preserve TMPV7 as KOFIA's published ratio. Across the full history it does
  // not consistently equal TMPV6 / TMPV5, so deriving a replacement ratio
  // from the displayed amounts would silently change the source definition.
  return { asOf: date, ...funding, ...credit, r2Percent }
}).filter((point) => point !== null)

const asOf = history.at(-1)?.asOf
if (!asOf || history.length < 7_000 || history[0]?.asOf !== '1998-07-01') {
  throw new Error(`KOFIA history coverage failed validation: ${history.length} observations from ${history[0]?.asOf} to ${history.at(-1)?.asOf}`)
}

const latest = history.at(-1)
if (!latest) throw new Error('KOFIA history contained no observations')

const tenYearHistory = history.slice(-TEN_YEAR_TRADING_DAYS)
const r2TenYearPercentile = percentileAtOrBelow(tenYearHistory.map((point) => point.r2Percent), latest.r2Percent)
const forcedLiquidationFiveDayAverageMillions = history.slice(-5).reduce((sum, point) => sum + point.forcedLiquidationMillions, 0) / 5
const tenYearLiquidationAverages = rollingAverage(tenYearHistory.map((point) => point.forcedLiquidationMillions), 5)
const forcedLiquidationTenYearPercentile = percentileAtOrBelow(tenYearLiquidationAverages, forcedLiquidationFiveDayAverageMillions)
const browserHistory = history.map(({ asOf, r2Percent }) => ({ asOf, r2Percent }))
// Keep the specialist view bounded to the same ten-year window used for the
// percentiles. These are source fields, not reconstructed values.
const drilldownHistory = tenYearHistory.map((point) => ({
  label: point.asOf,
  forcedLiquidationMillions: point.forcedLiquidationMillions,
  unpaidReceivablesMillions: point.unpaidReceivablesMillions,
  forcedLiquidationToUnpaidPercent: point.forcedLiquidationToUnpaidPercent,
  marginCreditMillions: point.marginCreditMillions,
  creditShortMillions: point.creditShortMillions,
  subscriptionLoanMillions: point.subscriptionLoanMillions,
  collateralLoanMillions: point.collateralLoanMillions,
  totalCreditSupplyMillions: point.totalCreditSupplyMillions,
}))

const rawSnapshot = JSON.stringify({
  source: {
    funding: SOURCE_URL,
    credit: CREDIT_SOURCE_URL,
    fundingRequest: historyRequest(FUNDING_SERVICE, queryEnd),
    creditRequest: historyRequest(CREDIT_SERVICE, queryEnd),
  },
  responses: {
    funding: fundingResult.payload,
    credit: creditResult.payload,
  },
})
const snapshotHash = createHash('sha256').update(rawSnapshot).digest('hex')
const archiveRelativePath = `data/raw/kr/${asOf}-${snapshotHash.slice(0, 12)}.json`
const archiveUrl = `https://raw.githubusercontent.com/x-tong/leverage-liquidity-radar/main/${archiveRelativePath}`
const archivePath = new URL(`../${archiveRelativePath}`, import.meta.url)
await mkdir(new URL('../data/raw/kr/', import.meta.url), { recursive: true })
await writeFile(archivePath, rawSnapshot, { flag: 'wx' }).catch((error) => {
  if (error?.code !== 'EEXIST') throw error
})

const snapshot = {
  refreshedAt: asOf,
  asOf,
  sourceUrl: SOURCE_URL,
  creditSourceUrl: CREDIT_SOURCE_URL,
  sourceHash: `sha256:${snapshotHash}`,
  archiveRelativePath,
  archiveUrl,
  investorDepositsMillions: latest.investorDepositsMillions,
  marginCreditMillions: latest.marginCreditMillions,
  collateralLoanMillions: latest.collateralLoanMillions,
  totalCreditSupplyMillions: latest.totalCreditSupplyMillions,
  unpaidReceivablesMillions: latest.unpaidReceivablesMillions,
  forcedLiquidationMillions: latest.forcedLiquidationMillions,
  forcedLiquidationToUnpaidPercent: latest.forcedLiquidationToUnpaidPercent,
  statistics: {
    observations: history.length,
    start: history[0].asOf,
    r2TenYearPercentile,
    r2TenYearObservations: tenYearHistory.length,
    forcedLiquidationFiveDayAverageMillions,
    forcedLiquidationTenYearPercentile,
    forcedLiquidationTenYearObservations: tenYearLiquidationAverages.length,
  },
  // The complete field-level history is preserved in the raw snapshot. The
  // browser receives only the series rendered in its main interactive chart.
  history: browserHistory,
}

const output = `// Generated by scripts/refresh-korea-data.mjs. Do not edit by hand.\nexport const latestKR = ${JSON.stringify(snapshot, null, 2)} as const\n`
await writeFile(new URL('../src/generated/latestKorea.ts', import.meta.url), output)
const drilldownOutput = `// Generated by scripts/refresh-korea-data.mjs. Do not edit by hand.\nexport const latestKoreaDrilldown = ${JSON.stringify({
  asOf,
  start: drilldownHistory[0]?.label,
  sourceUrl: SOURCE_URL,
  creditSourceUrl: CREDIT_SOURCE_URL,
  sourceHash: `sha256:${snapshotHash}`,
  archiveUrl,
  points: drilldownHistory,
}, null, 2)}\n`
await writeFile(new URL('../src/generated/latestKoreaDrilldown.ts', import.meta.url), drilldownOutput)
await browser.close()
