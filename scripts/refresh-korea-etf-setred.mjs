/**
 * Build an auditable daily Korean leveraged/inverse ETF creation-redemption
 * series from KSD SEIBro. The public service reports units of creation
 * units (CU), not monetary fund flows, so this script deliberately keeps
 * the published unit of account instead of applying a price conversion.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const CONTROL_URL = 'https://seibro.or.kr/IPORTAL/user/etf/BIP_CNTS06028V.xml'
const SERVICE_URL = 'https://seibro.or.kr/websquare/engine/proworks/callServletService.jsp'
const SOURCE_URL = CONTROL_URL
const TASK = 'ksd.safe.bip.cnts.etf.process.EtfSetredInfoPTask'
const START_DATE = '2024-01-02'
const RECENT_RECHECK_CALENDAR_DAYS = 14
const REQUEST_CONCURRENCY = 5
const MINIMUM_OBSERVATIONS = 500

function dateAtUtc(value) {
  return new Date(`${value}T00:00:00Z`)
}

function isoDate(value) {
  return value.toISOString().slice(0, 10)
}

function compactDate(value) {
  return value.replaceAll('-', '')
}

function isWeekday(value) {
  const day = dateAtUtc(value).getUTCDay()
  return day !== 0 && day !== 6
}

function candidateDates(start, end) {
  const cursor = dateAtUtc(start)
  const finalDate = dateAtUtc(end)
  const dates = []
  while (cursor <= finalDate) {
    const value = isoDate(cursor)
    if (isWeekday(value)) dates.push(value)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function normalizeRawResponse(raw) {
  // KSD includes execution timestamps in the response root. They do not alter
  // the reported observation and would otherwise make same-day hashes noisy.
  return raw.replaceAll(/\s(?:before|after)(?:Servlet|EJB)Call="\d+"/g, '')
}

function readResultRows(raw) {
  return [...raw.matchAll(/<result>([\s\S]*?)<\/result>/g)].map((match) => {
    const values = Object.fromEntries([...match[1].matchAll(/<([A-Z_]+)\s+value="([^"]*)"\s*\/>/g)].map((field) => [field[1], field[2]]))
    return values
  })
}

function requiredNumber(row, field, date) {
  const value = Number(row[field])
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`KSD ${date} ${field} is not a non-negative number`)
  }
  return value
}

function parseDailyResponse(raw, requestedDate) {
  const rows = readResultRows(raw)
  if (!rows.length) throw new Error(`KSD ${requestedDate} response did not contain result rows`)

  const dates = new Set(rows.map((row) => row.MAXDT).filter(Boolean))
  if (!dates.size) return null // Weekend and Korean market holidays are blank by design.
  if (dates.size !== 1 || !dates.has(compactDate(requestedDate))) {
    throw new Error(`KSD ${requestedDate} response did not preserve its requested single-date boundary`)
  }

  const leveraged = rows.find((row) => row.COL === 'P0101')
  const inverse = rows.find((row) => row.COL === 'P0201')
  if (!leveraged || !inverse) throw new Error(`KSD ${requestedDate} response is missing leveraged or inverse ETF categories`)

  const leveragedSetupCu = requiredNumber(leveraged, 'SETUP_CU_QTY', requestedDate)
  const leveragedRedemptionCu = requiredNumber(leveraged, 'RP_CU_QTY', requestedDate)
  const inverseSetupCu = requiredNumber(inverse, 'SETUP_CU_QTY', requestedDate)
  const inverseRedemptionCu = requiredNumber(inverse, 'RP_CU_QTY', requestedDate)

  return {
    label: requestedDate,
    leveragedSetupCu,
    leveragedRedemptionCu,
    leveragedNetCu: leveragedSetupCu - leveragedRedemptionCu,
    inverseSetupCu,
    inverseRedemptionCu,
    inverseNetCu: inverseSetupCu - inverseRedemptionCu,
  }
}

async function pause(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function requestDailyRaw(date) {
  const requestBody = `<reqParam action="sortBySetredList" task="${TASK}"><mngco_custno value=""/><fromDt value="${compactDate(date)}"/><toDt value="${compactDate(date)}"/></reqParam>`
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(SERVICE_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/xml; charset=UTF-8',
          origin: 'https://seibro.or.kr',
          referer: SOURCE_URL,
          'user-agent': 'Mozilla/5.0',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: requestBody,
      })
      if (!response.ok) throw new Error(`KSD returned HTTP ${response.status}`)
      return normalizeRawResponse(await response.text())
    } catch (error) {
      lastError = error
      if (attempt < 2) await pause(300 * (attempt + 1))
    }
  }
  throw new Error(`KSD ${date} request failed after retries: ${String(lastError)}`)
}

async function latestPriorSnapshot() {
  const directory = new URL('../data/raw/kr-etf-setred/', import.meta.url)
  const entries = await readdir(directory).catch((error) => error?.code === 'ENOENT' ? [] : Promise.reject(error))
  const generated = await readFile(new URL('../src/generated/latestKoreaEtfSetred.ts', import.meta.url), 'utf8').catch(() => '')
  const publishedFilename = generated.match(/"archiveRelativePath": "data\/raw\/kr-etf-setred\/([^"]+)"/)?.[1]
  const candidates = entries
    .map((filename) => {
      const match = filename.match(/^(\d{4}-\d{2}-\d{2})-[a-f0-9]{12}\.json$/)
      return match ? { filename, asOf: match[1] } : null
    })
    .filter((candidate) => candidate !== null)
    .sort((left, right) => {
      if (left.filename === publishedFilename) return -1
      if (right.filename === publishedFilename) return 1
      return right.filename.localeCompare(left.filename)
    })

  for (const candidate of candidates) {
    try {
      const raw = await readFile(new URL(`../data/raw/kr-etf-setred/${candidate.filename}`, import.meta.url), 'utf8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed?.series) || !parsed.series.every((point) => typeof point?.label === 'string')) continue
      return {
        ...candidate,
        archiveUrl: `https://raw.githubusercontent.com/x-tong/leverage-liquidity-radar/main/data/raw/kr-etf-setred/${candidate.filename}`,
        sourceHash: `sha256:${createHash('sha256').update(raw).digest('hex')}`,
        series: parsed.series,
        unavailableDates: Array.isArray(parsed.unavailableDates) ? parsed.unavailableDates.filter((date) => typeof date === 'string') : [],
      }
    } catch {
      // Invalid old archives are never used as a data baseline.
    }
  }
  return null
}

async function mapInBatches(items, mapper, batchSize) {
  const results = []
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.all(items.slice(index, index + batchSize).map(mapper)))
  }
  return results
}

const queryEnd = isoDate(new Date())
// Visit the public control first. It verifies the task's published UI exists
// before using the UI's backing service, and helps with intermittent WAF state.
const controlResponse = await fetch(CONTROL_URL, { headers: { 'user-agent': 'Mozilla/5.0' } })
if (!controlResponse.ok) throw new Error(`KSD ETF set/red control returned HTTP ${controlResponse.status}`)
const controlRaw = await controlResponse.text()
if (!controlRaw.includes(TASK) || !controlRaw.includes('SETUP_CU_QTY') || !controlRaw.includes('RP_CU_QTY')) {
  throw new Error('KSD ETF set/red control no longer exposes its expected task or CU fields')
}

const priorSnapshot = await latestPriorSnapshot()
const priorPoints = priorSnapshot?.series ?? []
const priorByDate = new Map(priorPoints.map((point) => [point.label, point]))
const priorUnavailableDates = new Set(priorSnapshot?.unavailableDates ?? [])
const allCandidates = candidateDates(START_DATE, queryEnd)
const recheckStart = dateAtUtc(queryEnd)
recheckStart.setUTCDate(recheckStart.getUTCDate() - RECENT_RECHECK_CALENDAR_DAYS)
const recheckCutoff = isoDate(recheckStart)
const datesToFetch = allCandidates.filter((date) => (!priorByDate.has(date) && !priorUnavailableDates.has(date)) || date >= recheckCutoff)

const fetched = await mapInBatches(datesToFetch, async (date) => {
  const raw = await requestDailyRaw(date)
  return { date, raw, point: parseDailyResponse(raw, date) }
}, REQUEST_CONCURRENCY)

for (const item of fetched) {
  if (item.point) {
    priorByDate.set(item.date, item.point)
    priorUnavailableDates.delete(item.date)
  } else {
    priorUnavailableDates.add(item.date)
  }
}
const series = [...priorByDate.values()].sort((left, right) => left.label.localeCompare(right.label))
const unavailableDates = [...priorUnavailableDates].sort()
if (series.length < MINIMUM_OBSERVATIONS || series[0]?.label !== START_DATE) {
  throw new Error(`KSD ETF set/red history validation failed: ${series.length} observations from ${series[0]?.label ?? '—'}`)
}

const latest = series.at(-1)
if (!latest) throw new Error('KSD ETF set/red history is empty')

const seriesChanged = JSON.stringify(series) !== JSON.stringify(priorPoints)
const unavailableDatesChanged = JSON.stringify(unavailableDates) !== JSON.stringify(priorSnapshot?.unavailableDates ?? [])
let sourceHash
let archiveRelativePath
let archiveUrl

if (seriesChanged || unavailableDatesChanged) {
  const rawSnapshot = JSON.stringify({
    source: {
      control: CONTROL_URL,
      service: SERVICE_URL,
      task: TASK,
      definition: 'KSD published ETF setup/redemption units (CU). This archive does not convert CU into money or fund flows.',
    },
    inheritedFrom: priorSnapshot ? {
      asOf: priorSnapshot.asOf,
      archiveUrl: priorSnapshot.archiveUrl,
    } : null,
    fetchedResponses: fetched.map(({ date, raw }) => ({ date, raw })),
    series,
    unavailableDates,
  })
  const snapshotHash = createHash('sha256').update(rawSnapshot).digest('hex')
  archiveRelativePath = `data/raw/kr-etf-setred/${latest.label}-${snapshotHash.slice(0, 12)}.json`
  archiveUrl = `https://raw.githubusercontent.com/x-tong/leverage-liquidity-radar/main/${archiveRelativePath}`
  sourceHash = `sha256:${snapshotHash}`
  await mkdir(new URL('../data/raw/kr-etf-setred/', import.meta.url), { recursive: true })
  await writeFile(new URL(`../${archiveRelativePath}`, import.meta.url), rawSnapshot, { flag: 'wx' }).catch((error) => {
    if (error?.code !== 'EEXIST') throw error
  })
} else if (priorSnapshot) {
  archiveRelativePath = `data/raw/kr-etf-setred/${priorSnapshot.filename}`
  archiveUrl = priorSnapshot.archiveUrl
  sourceHash = priorSnapshot.sourceHash
} else {
  throw new Error('KSD ETF set/red had no prior archive and no changed series')
}

const output = `// Generated by scripts/refresh-korea-etf-setred.mjs. Do not edit by hand.\nexport const latestKREtfSetred = ${JSON.stringify({
  refreshedAt: latest.label,
  asOf: latest.label,
  start: series[0].label,
  observations: series.length,
  sourceUrl: SOURCE_URL,
  sourceHash,
  archiveRelativePath,
  archiveUrl,
  latest,
  series,
}, null, 2)} as const\n`
await writeFile(new URL('../src/generated/latestKoreaEtfSetred.ts', import.meta.url), output)

console.log(`KSD ETF set/red: ${series.length} observations from ${series[0].label} to ${latest.label}; fetched ${fetched.length} candidate weekdays; ${seriesChanged || unavailableDatesChanged ? 'published updated snapshot' : 'recheck matched existing snapshot'}`)
