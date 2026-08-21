import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const MARKET_CAP_THRESHOLD = 80_000_000_000;
const MAX_SYMBOLS = 180;
const CONCURRENCY = 4;
const NASDAQ_ENDPOINT = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=5000&exchange=";
const headers = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "Mozilla/5.0 (compatible; MACD-Personal-Desk/1.0)",
};

const toNumber = value => {
  const normalized = String(value ?? "").replace(/[$,]/g, "").trim();
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function fetchCandidates() {
  const payloads = await Promise.all(["NASDAQ", "NYSE"].map(exchange => fetchJson(`${NASDAQ_ENDPOINT}${exchange}`)));
  const symbols = new Map();
  for (const payload of payloads) {
    for (const row of payload?.data?.table?.rows ?? []) {
      const symbol = String(row.symbol ?? "").trim().toUpperCase();
      const marketCap = toNumber(row.marketCap);
      const companyName = String(row.name ?? "").trim();
      if (!symbol || !companyName || !marketCap || marketCap < MARKET_CAP_THRESHOLD) continue;
      if (!/^[A-Z.-]+$/.test(symbol) || symbol.includes("^")) continue;
      symbols.set(symbol, { symbol, companyName, marketCap });
    }
  }
  return [...symbols.values()].sort((left, right) => right.marketCap - left.marketCap).slice(0, MAX_SYMBOLS);
}

async function fetchSeries(candidate) {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate.symbol)}?range=1y&interval=1d`;
  const payload = await fetchJson(endpoint);
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const bars = timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    return typeof close === "number" && Number.isFinite(close) && close > 0
      ? [{ date: new Date(timestamp * 1000).toISOString(), close }]
      : [];
  });
  return bars.length >= 35 ? { ...candidate, bars: bars.slice(-60) } : null;
}

async function mapConcurrent(items, mapper) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        const result = await mapper(item);
        if (result) results.push(result);
      } catch (error) {
        console.warn(`Skipping ${item.symbol}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
  });
  await Promise.all(workers);
  return results.sort((left, right) => left.symbol.localeCompare(right.symbol));
}

const target = resolve(process.cwd(), process.argv[2] ?? "client/public/market-snapshot.json");
const candidates = await fetchCandidates();
const series = await mapConcurrent(candidates, fetchSeries);
if (series.length === 0) throw new Error("No usable market series were retrieved; snapshot was not replaced.");

const marketDate = series.flatMap(item => item.bars.map(bar => bar.date.slice(0, 10))).sort().at(-1);
try {
  const previous = JSON.parse(await readFile(target, "utf8"));
  if (typeof previous.marketDate === "string" && previous.marketDate >= marketDate) {
    console.log(`No newer market date than ${previous.marketDate}; snapshot was kept.`);
    process.exit(0);
  }
} catch {
  // A first run has no existing snapshot to compare.
}
const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  marketDate,
  source: "NASDAQ screener + Yahoo Finance daily chart",
  series,
};

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(snapshot)}\n`, "utf8");
console.log(`Wrote ${series.length} eligible large-cap symbols for ${marketDate} to ${target}`);
