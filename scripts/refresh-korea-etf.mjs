/** Capture KSD SEIBro ETF product coverage and issued-share market-value proxies. */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const SOURCE_URL = 'https://m.seibro.or.kr/cnts/etf/selectPublishInfo.do'
const DETAIL_URL = 'https://m.seibro.or.kr/cnts/etf/selectKindDetailInfo.do'
const NET_ASSET_URL = 'https://m.seibro.or.kr/cnts/etf/selectMarketSummary.do?orderByStr=3'
const MARKET_CAP_URL = 'https://m.seibro.or.kr/cnts/etf/selectMarketSummary.do?orderByStr=4'

async function fetchText(url, label) {
  const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!response.ok) throw new Error(`SEIBro ${label} request failed with HTTP ${response.status}`)
  return response.text()
}

const [raw, rawNetAssets, rawMarketCap] = await Promise.all([
  fetchText(SOURCE_URL, 'ETF product list'),
  fetchText(NET_ASSET_URL, 'ETF net-asset summary'),
  fetchText(MARKET_CAP_URL, 'ETF market-cap summary'),
])
const asOfMatch = raw.match(/기준일\s*:\s*(\d{4})\/(\d{2})\/(\d{2})/)
const headerMatch = raw.match(/<th>\s*3개월 수익률\s*<\/th>/)
if (!asOfMatch || !headerMatch) throw new Error('SEIBro ETF page did not expose its expected as-of date or return column')

const rows = [...raw.matchAll(/searchEtfDetailInfo\('([^']+)',\s*'([^']+)'\)[\s\S]*?<td class="tl">\s*([^<]+?)\s*<\/td>[\s\S]*?<td class="tc">\s*([^<]+?)\s*<\/td>[\s\S]*?<td class="tr">\s*([^<]+?)\s*<\/td>/g)].map((match) => {
  const returnPercent = Number(match[5].replaceAll(',', '').trim())
  if (!Number.isFinite(returnPercent)) throw new Error(`SEIBro ETF page returned an invalid return for ${match[2]}`)
  return { code: match[1], name: match[2], manager: match[3].trim(), category: match[4].trim(), returnPercent }
})
if (rows.length < 100 || new Set(rows.map((row) => row.code)).size !== rows.length) {
  throw new Error(`SEIBro ETF page returned insufficient or duplicate products: ${rows.length}`)
}

const geared = rows.filter((row) => row.category === '레버리지' || row.category === '인버스')
if (geared.length < 5) throw new Error(`SEIBro ETF page returned too few leveraged/inverse products: ${geared.length}`)
const asOf = `${asOfMatch[1]}-${asOfMatch[2]}-${asOfMatch[3]}`

function parseMarketSummary(rawSummary, expectedHeader, label) {
  const summaryAsOfMatch = rawSummary.match(/기준일\s*:\s*(\d{4})\/(\d{2})\/(\d{2})/)
  const headerMatch = rawSummary.match(new RegExp(`<th>${expectedHeader}<\\/th>`))
  if (!summaryAsOfMatch || !headerMatch) {
    throw new Error(`SEIBro ${label} summary did not expose its expected date or column`)
  }
  const summaryAsOf = `${summaryAsOfMatch[1]}-${summaryAsOfMatch[2]}-${summaryAsOfMatch[3]}`
  if (summaryAsOf !== asOf) {
    throw new Error(`SEIBro ${label} summary date ${summaryAsOf} does not match product date ${asOf}`)
  }
  const entries = [...rawSummary.matchAll(/searchEtfDetailInfo\('([^']+)',\s*'([^']+)'\)[\s\S]*?<td class="tc">\s*([^<]+?)\s*<\/td>[\s\S]*?<td class="tr">\s*([^<]+?)\s*<\/td>[\s\S]*?<td class="tr">\s*([^<]+?)\s*<\/td>/g)].map((match) => {
    const closeWon = Number(match[4].replaceAll(',', '').trim())
    const valueMillions = Number(match[5].replaceAll(',', '').trim())
    if (!Number.isFinite(closeWon) || closeWon <= 0 || !Number.isFinite(valueMillions) || valueMillions < 0) {
      throw new Error(`SEIBro ${label} summary has an invalid observation for ${match[1]}`)
    }
    return { code: match[1], category: match[3].trim(), closeWon, valueMillions }
  })
  if (entries.length < 100 || new Set(entries.map((entry) => entry.code)).size !== entries.length) {
    throw new Error(`SEIBro ${label} summary returned insufficient or duplicate products: ${entries.length}`)
  }
  return new Map(entries.map((entry) => [entry.code, entry]))
}

const netAssetsByCode = parseMarketSummary(rawNetAssets, '순자산총액', 'net-asset')
const marketCapByCode = parseMarketSummary(rawMarketCap, '시가총액', 'market-cap')

function valueForDetail(rawDetail, label, code) {
  const match = rawDetail.match(new RegExp(`<tr><th>${label}<\\/th><td>\\s*([^<]+?)\\s*<\\/td><\\/tr>`))
  if (!match) throw new Error(`SEIBro ETF detail is missing ${label} for ${code}`)
  const value = Number(match[1].replaceAll(',', '').trim())
  if (!Number.isFinite(value) || value < 0) throw new Error(`SEIBro ETF detail has invalid ${label} for ${code}`)
  return value
}

async function fetchDetail(row) {
  const query = new URLSearchParams({ InKindShort: '0', InKinds: '0', InMSect: '0', shotnIsin: row.code, txt_sch: row.name })
  const detailResponse = await fetch(`${DETAIL_URL}?${query}`, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!detailResponse.ok) throw new Error(`SEIBro ETF detail request failed with HTTP ${detailResponse.status} for ${row.code}`)
  const rawDetail = await detailResponse.text()
  const closeWon = valueForDetail(rawDetail, '종가\\(원\\)', row.code)
  const issuedShares = valueForDetail(rawDetail, '총발행주식수\\(주\\)', row.code)
  const netAssets = netAssetsByCode.get(row.code)
  const marketCap = marketCapByCode.get(row.code)
  if (!netAssets || !marketCap) throw new Error(`SEIBro market summary is missing geared ETF ${row.code}`)
  return {
    ...row,
    closeWon,
    issuedShares,
    marketValueWon: closeWon * issuedShares,
    netAssetsMillions: netAssets.valueMillions,
    officialMarketCapMillions: marketCap.valueMillions,
    rawDetail,
  }
}

// Bounded concurrency keeps KSD's public mobile service usable in CI.
const details = []
for (let index = 0; index < geared.length; index += 8) {
  details.push(...await Promise.all(geared.slice(index, index + 8).map(fetchDetail)))
}
if (details.some((row) => row.closeWon === 0 || row.issuedShares === 0)) {
  throw new Error('SEIBro ETF detail returned a zero close or issued-share count')
}
if (details.some((row) => row.netAssetsMillions === 0 || row.officialMarketCapMillions === 0)) {
  throw new Error('SEIBro ETF market summary returned a zero net asset or market capitalization')
}

async function latestPriorSnapshot(currentAsOf) {
  const archiveDirectory = new URL('../data/raw/kr-etf/', import.meta.url)
  const candidates = (await readdir(archiveDirectory)).map((filename) => {
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})-[a-f0-9]{12}\.json$/)
    return match && match[1] < currentAsOf ? { filename, asOf: match[1] } : null
  }).filter((candidate) => candidate !== null).sort((left, right) => {
    const dateOrder = right.asOf.localeCompare(left.asOf)
    return dateOrder || right.filename.localeCompare(left.filename)
  })
  for (const candidate of candidates) {
    try {
      const rawPrior = await readFile(new URL(`../data/raw/kr-etf/${candidate.filename}`, import.meta.url), 'utf8')
      const prior = JSON.parse(rawPrior)
      if (!Array.isArray(prior?.gearedDetails) || prior.gearedDetails.length < 5) continue
      const priorDetails = prior.gearedDetails.map((row) => ({
        code: String(row.code),
        issuedShares: Number(row.issuedShares),
      }))
      if (priorDetails.some((row) => !row.code || !Number.isFinite(row.issuedShares) || row.issuedShares < 0)) continue
      return { ...candidate, details: priorDetails }
    } catch {
      // A malformed old archive must not become the baseline for a new metric.
    }
  }
  return null
}

const priorSnapshot = await latestPriorSnapshot(asOf)
const issuedShareChange = priorSnapshot ? (() => {
  const previousByCode = new Map(priorSnapshot.details.map((row) => [row.code, row.issuedShares]))
  const matched = details.filter((row) => previousByCode.has(row.code))
  if (matched.length < 5) throw new Error(`SEIBro issued-share comparison has insufficient matched products: ${matched.length}`)
  const increasedProducts = matched.filter((row) => row.issuedShares > previousByCode.get(row.code)).length
  const decreasedProducts = matched.filter((row) => row.issuedShares < previousByCode.get(row.code)).length
  return {
    previousAsOf: priorSnapshot.asOf,
    previousArchiveRelativePath: `data/raw/kr-etf/${priorSnapshot.filename}`,
    previousArchiveUrl: `https://raw.githubusercontent.com/x-tong/leverage-liquidity-radar/main/data/raw/kr-etf/${priorSnapshot.filename}`,
    matchedProducts: matched.length,
    increasedProducts,
    decreasedProducts,
    netIssuedShares: matched.reduce((sum, row) => sum + row.issuedShares - (previousByCode.get(row.code) ?? 0), 0),
    netIssuedSharesAtCurrentCloseMillions: matched.reduce((sum, row) => sum + ((row.issuedShares - (previousByCode.get(row.code) ?? 0)) * row.closeWon), 0) / 1_000_000,
  }
})() : null

const snapshotPayload = {
  source: { products: SOURCE_URL, detail: DETAIL_URL, netAssets: NET_ASSET_URL, marketCap: MARKET_CAP_URL },
  products: rows,
  gearedDetails: details.map(({ rawDetail, ...detail }) => detail),
  rawMarketSummary: { netAssets: rawNetAssets, marketCap: rawMarketCap },
  rawDetails: details.map(({ code, rawDetail }) => ({ code, rawDetail })),
}
const rawSnapshot = JSON.stringify(snapshotPayload)

function normalizeSessionTokens(rawResponse) {
  // SEIBro injects a new JSESSIONID into links on every request. It does not
  // change an observation, so including it in the content hash would create a
  // new audit archive for the same reported data on every rerun.
  return rawResponse
    .replaceAll(/;jsessionid=[^"'\s<>?]+/gi, ';jsessionid=<session>')
    .replaceAll(/\bJSESSIONID=[^;"'\s<>]+/gi, 'JSESSIONID=<session>')
}

const hashPayload = JSON.stringify({
  ...snapshotPayload,
  rawMarketSummary: {
    netAssets: normalizeSessionTokens(rawNetAssets),
    marketCap: normalizeSessionTokens(rawMarketCap),
  },
  rawDetails: details.map(({ code, rawDetail }) => ({ code, rawDetail: normalizeSessionTokens(rawDetail) })),
})
const snapshotHash = createHash('sha256').update(hashPayload).digest('hex')
const archiveRelativePath = `data/raw/kr-etf/${asOf}-${snapshotHash.slice(0, 12)}.json`
const archiveUrl = `https://raw.githubusercontent.com/x-tong/leverage-liquidity-radar/main/${archiveRelativePath}`
await mkdir(new URL('../data/raw/kr-etf/', import.meta.url), { recursive: true })
await writeFile(new URL(`../${archiveRelativePath}`, import.meta.url), rawSnapshot, { flag: 'wx' }).catch((error) => {
  if (error?.code !== 'EEXIST') throw error
})

const output = `// Generated by scripts/refresh-korea-etf.mjs. Do not edit by hand.\nexport const latestKREtf = ${JSON.stringify({
  refreshedAt: asOf,
  sourceUrl: SOURCE_URL,
  sourceHash: `sha256:${snapshotHash}`,
  archiveRelativePath,
  archiveUrl,
  totalProducts: rows.length,
  gearedProducts: geared.length,
  leveragedProducts: geared.filter((row) => row.category === '레버리지').length,
  inverseProducts: geared.filter((row) => row.category === '인버스').length,
  gearedIssuedShares: details.reduce((sum, row) => sum + row.issuedShares, 0),
  gearedMarketValueWon: details.reduce((sum, row) => sum + row.marketValueWon, 0),
  gearedNetAssetsMillions: details.reduce((sum, row) => sum + row.netAssetsMillions, 0),
  gearedOfficialMarketCapMillions: details.reduce((sum, row) => sum + row.officialMarketCapMillions, 0),
  gearedOfficialMarketPremiumPercent: ((details.reduce((sum, row) => sum + row.officialMarketCapMillions, 0) / details.reduce((sum, row) => sum + row.netAssetsMillions, 0)) - 1) * 100,
  gearedIssuedShareChange: issuedShareChange,
}, null, 2)} as const\n`
await writeFile(new URL('../src/generated/latestKoreaEtf.ts', import.meta.url), output)
