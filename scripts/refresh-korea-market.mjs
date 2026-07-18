/**
 * Build a cross-checked Korean index reference.
 *
 * KOFIA FreeSIS provides the daily KOSPI/KOSDAQ market-statistic series. The
 * public Naver Finance feed remains a separate vendor cross-check. Neither
 * is described here as a primary KRX settlement source.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const Naver_API_ROOT = 'https://api.stock.naver.com/chart/domestic/index'
const KOFIA_HISTORY_ENDPOINT = 'https://freesis.kofia.or.kr/meta/getMetaDataList.do'
const KOFIA_ENTRY_URL = 'https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=STATSCU0100000020'
const KOFIA_KOSPI_SERVICE = 'STATSCU0100000020BO'
const KOFIA_KOSDAQ_SERVICE = 'STATSCU0100000030BO'
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const executablePath = process.env.KOFIA_CHROME_PATH || (existsSync(localChrome) ? localChrome : undefined)

const sourceUrl = (code) => `${Naver_API_ROOT}/${code}?periodType=year`
const kofiaSourceUrl = (serviceId) => `https://freesis.kofia.or.kr/stat/FreeSIS.do?parentDivId=MSIS10000000000000&serviceId=${serviceId.replace(/BO$/, '')}`

function toIsoDate(value, source) {
  const date = String(value)
  if (!/^\d{8}$/.test(date)) throw new Error(`${source} returned an invalid reference date: ${date}`)
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
}

function positiveNumber(value, source) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${source} returned an invalid positive number: ${String(value)}`)
  return number
}

async function fetchNaverIndex(code) {
  const response = await fetch(sourceUrl(code), { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!response.ok) throw new Error(`Naver Finance ${code} request failed with HTTP ${response.status}`)
  const raw = await response.text()
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(`Naver Finance ${code} did not return JSON`)
  }
  if (payload?.code !== code || payload?.infoType !== 'index' || !Array.isArray(payload?.priceInfos)) {
    throw new Error(`Naver Finance ${code} returned an unexpected payload`)
  }
  const history = payload.priceInfos.map((point) => ({
    asOf: toIsoDate(point.localDate, `Naver Finance ${code}`),
    close: positiveNumber(point.closePrice, `Naver Finance ${code}`),
  })).sort((left, right) => left.asOf.localeCompare(right.asOf))
  if (history.length < 40 || new Set(history.map((point) => point.asOf)).size !== history.length) {
    throw new Error(`Naver Finance ${code} returned insufficient or duplicate history`)
  }
  const latest = history.at(-1)
  if (!latest) throw new Error(`Naver Finance ${code} returned no history`)
  return { raw, payload, latest }
}

function kofiaHistoryRequest(service, startDate, endDate) {
  return {
    dmSearch: {
      tmpV40: '1000000',
      tmpV41: '1',
      tmpV1: 'D',
      tmpV45: startDate.replaceAll('-', ''),
      tmpV46: endDate.replaceAll('-', ''),
      OBJ_NM: service,
    },
  }
}

async function fetchKofiaJson(page, body, source) {
  const response = await page.evaluate(async ({ requestUrl, requestBody }) => {
    const result = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
    return { status: result.status, raw: await result.text() }
  }, { requestUrl: KOFIA_HISTORY_ENDPOINT, requestBody: body })
  if (response.status !== 200) throw new Error(`${source} request failed with HTTP ${response.status}`)
  try {
    return JSON.parse(response.raw)
  } catch {
    throw new Error(`${source} did not return JSON`)
  }
}

function parseKofiaHistory(payload, source) {
  if (!Array.isArray(payload?.ds1)) throw new Error(`${source} response did not contain ds1`)
  const history = payload.ds1.map((row) => ({
    asOf: toIsoDate(row.TMPV1, source),
    // The reported close is validated below against the same-date Naver feed.
    close: positiveNumber(row.TMPV2, source),
  })).sort((left, right) => left.asOf.localeCompare(right.asOf))
  if (history.length < 200 || new Set(history.map((point) => point.asOf)).size !== history.length) {
    throw new Error(`${source} returned insufficient or duplicate history: ${history.length}`)
  }
  const latest = history.at(-1)
  if (!latest) throw new Error(`${source} returned no history`)
  return { history, latest }
}

function sameClose(left, right, label) {
  if (Math.abs(left - right) > 0.0001) throw new Error(`${label} did not match: ${left} vs ${right}`)
}

const queryEnd = new Date().toISOString().slice(0, 10)
const queryStartDate = new Date(`${queryEnd}T00:00:00Z`)
queryStartDate.setUTCFullYear(queryStartDate.getUTCFullYear() - 1)
const queryStart = queryStartDate.toISOString().slice(0, 10)
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const page = await browser.newPage()
await page.goto(KOFIA_ENTRY_URL, { waitUntil: 'networkidle', timeout: 60_000 })

const [kofiaKospiPayload, kofiaKosdaqPayload, naverKospi, naverKosdaq] = await Promise.all([
  fetchKofiaJson(page, kofiaHistoryRequest(KOFIA_KOSPI_SERVICE, queryStart, queryEnd), 'KOFIA KOSPI history'),
  fetchKofiaJson(page, kofiaHistoryRequest(KOFIA_KOSDAQ_SERVICE, queryStart, queryEnd), 'KOFIA KOSDAQ history'),
  fetchNaverIndex('KOSPI'),
  fetchNaverIndex('KOSDAQ'),
])
await browser.close()

const kospi = parseKofiaHistory(kofiaKospiPayload, 'KOFIA KOSPI history')
const kosdaq = parseKofiaHistory(kofiaKosdaqPayload, 'KOFIA KOSDAQ history')
if (kospi.latest.asOf !== kosdaq.latest.asOf || kospi.latest.asOf !== naverKospi.latest.asOf || kosdaq.latest.asOf !== naverKosdaq.latest.asOf) {
  throw new Error(`Korean index latest dates disagree: KOFIA ${kospi.latest.asOf}/${kosdaq.latest.asOf}, Naver ${naverKospi.latest.asOf}/${naverKosdaq.latest.asOf}`)
}
sameClose(kospi.latest.close, naverKospi.latest.close, 'KOFIA and Naver KOSPI')
sameClose(kosdaq.latest.close, naverKosdaq.latest.close, 'KOFIA and Naver KOSDAQ')
const asOf = kospi.latest.asOf

const rawSnapshot = JSON.stringify({
  source: {
    kofiaKospi: kofiaSourceUrl(KOFIA_KOSPI_SERVICE),
    kofiaKosdaq: kofiaSourceUrl(KOFIA_KOSDAQ_SERVICE),
    naverKospi: sourceUrl('KOSPI'),
    naverKosdaq: sourceUrl('KOSDAQ'),
  },
  requests: {
    kofiaKospi: kofiaHistoryRequest(KOFIA_KOSPI_SERVICE, queryStart, queryEnd),
    kofiaKosdaq: kofiaHistoryRequest(KOFIA_KOSDAQ_SERVICE, queryStart, queryEnd),
  },
  responses: {
    kofiaKospi: kofiaKospiPayload,
    kofiaKosdaq: kofiaKosdaqPayload,
    naverKospi: naverKospi.payload,
    naverKosdaq: naverKosdaq.payload,
  },
})
const snapshotHash = createHash('sha256').update(rawSnapshot).digest('hex')
const archiveRelativePath = `data/raw/kr-market/${asOf}-${snapshotHash.slice(0, 12)}.json`
const archiveUrl = `https://raw.githubusercontent.com/x-tong/leverage-liquidity-radar/main/${archiveRelativePath}`
await mkdir(new URL('../data/raw/kr-market/', import.meta.url), { recursive: true })
await writeFile(new URL(`../${archiveRelativePath}`, import.meta.url), rawSnapshot, { flag: 'wx' }).catch((error) => {
  if (error?.code !== 'EEXIST') throw error
})

function indexSnapshot(index) {
  const first = index.history[0]
  return {
    asOf: index.latest.asOf,
    close: index.latest.close,
    trailingReturnPercent: ((index.latest.close / first.close) - 1) * 100,
    observations: index.history.length,
    history: index.history,
  }
}

const output = `// Generated by scripts/refresh-korea-market.mjs. Do not edit by hand.\nexport const latestKRMarket = ${JSON.stringify({
  refreshedAt: asOf,
  sourceHash: `sha256:${snapshotHash}`,
  sourceUrl: kofiaSourceUrl(KOFIA_KOSPI_SERVICE),
  kofiaSources: {
    kospi: kofiaSourceUrl(KOFIA_KOSPI_SERVICE),
    kosdaq: kofiaSourceUrl(KOFIA_KOSDAQ_SERVICE),
  },
  vendorCrossCheck: {
    source: 'Naver Finance public KRX index feed',
    sourceUrl: Naver_API_ROOT,
    asOf,
    kospiDifference: kospi.latest.close - naverKospi.latest.close,
    kosdaqDifference: kosdaq.latest.close - naverKosdaq.latest.close,
  },
  archiveRelativePath,
  archiveUrl,
  kospi: indexSnapshot(kospi),
  kosdaq: indexSnapshot(kosdaq),
}, null, 2)} as const\n`
await writeFile(new URL('../src/generated/latestKoreaMarket.ts', import.meta.url), output)
