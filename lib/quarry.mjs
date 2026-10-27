import { cacheGet, cacheSet } from "./db.mjs";
import { esc } from "./format.mjs";

export const CITIES = [
  { id: "seattle", name: "Seattle", latitude: 47.61, longitude: -122.33 },
  { id: "lisbon", name: "Lisbon", latitude: 38.72, longitude: -9.14 },
  { id: "nairobi", name: "Nairobi", latitude: -1.29, longitude: 36.82 },
  { id: "tokyo", name: "Tokyo", latitude: 35.68, longitude: 139.69 },
  { id: "mexico-city", name: "Mexico City", latitude: 19.43, longitude: -99.13 },
];

const DATASETS = new Set(["population", "quakes", "weather"]);
const TTL = 15 * 60 * 1000;

export function isDataset(value) {
  return DATASETS.has(value);
}

export function cityById(id) {
  return CITIES.find((city) => city.id === id) || null;
}

export async function loadDataset(dataset, cityId) {
  if (dataset === "population") return cached("population", fetchPopulation);
  if (dataset === "quakes") return cached("quakes", fetchQuakes);
  if (dataset === "weather") {
    const city = cityById(cityId);
    if (!city) {
      const error = new Error("Pick a city from the list.");
      error.status = 400;
      throw error;
    }
    return cached(`weather:${city.id}`, () => fetchWeather(city));
  }
  const error = new Error("Pick a public dataset.");
  error.status = 400;
  throw error;
}

async function cached(key, loader) {
  const hit = cacheGet(key, TTL);
  if (hit) return hit;
  const value = await loader();
  cacheSet(key, value);
  return value;
}

async function fetchPopulation() {
  const url =
    "https://api.worldbank.org/v2/country/USA;GBR;JPN;BRA;NGA;IND;DEU;MEX/indicator/SP.POP.TOTL?format=json&mrv=1&per_page=20";
  const payload = await getJson(url);
  const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
  const series = rows
    .filter((row) => row && typeof row.value === "number")
    .map((row) => ({ label: row.country.value, value: row.value }))
    .sort((a, b) => b.value - a.value);
  const year = rows.find((row) => row?.date)?.date || "latest";
  return {
    title: "Population",
    source: `World Bank, population total, ${year}`,
    rows: series,
  };
}

async function fetchQuakes() {
  const payload = await getJson(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
  );
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const series = features
    .map((feature) => ({
      label: shorten(feature?.properties?.place || "Earthquake", 32),
      value: Number(feature?.properties?.mag),
    }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  return {
    title: "Earthquake magnitude",
    source: "USGS magnitude 4.5+ earthquakes, past day",
    rows: series,
  };
}

async function fetchWeather(city) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}` +
    "&daily=temperature_2m_max&timezone=UTC&forecast_days=7";
  const payload = await getJson(url);
  const days = payload?.daily?.time || [];
  const temps = payload?.daily?.temperature_2m_max || [];
  const series = days.map((day, index) => ({
    label: String(day).slice(5),
    value: Number(temps[index]),
  })).filter((row) => Number.isFinite(row.value));
  return {
    title: `Daily high in ${city.name}`,
    source: `Open-Meteo daily high, ${city.name}`,
    rows: series,
  };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Public data responded ${response.status}`);
  return response.json();
}

function shorten(value, max) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function barChart(chart) {
  const rows = Array.isArray(chart?.rows) ? chart.rows : [];
  if (!rows.length) {
    return `<p class="empty">No rows came back from ${esc(chart?.source || "the public source")}.</p>`;
  }
  const width = 720;
  const barH = 22;
  const gap = 10;
  const pad = { l: 168, r: 72, t: 16, b: 36 };
  const height = pad.t + pad.b + rows.length * (barH + gap);
  const innerW = width - pad.l - pad.r;
  const max = Math.max(...rows.map((row) => row.value), 0.0001);
  const bars = rows
    .map((row, index) => {
      const y = pad.t + index * (barH + gap);
      const w = Math.max(2, (row.value / max) * innerW);
      const label = esc(shorten(row.label, 22));
      return `<text x="${pad.l - 10}" y="${y + 16}" text-anchor="end" fill="#1a1714" font-size="13">${label}</text>
        <rect x="${pad.l}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="5" fill="#c4622d"></rect>
        <text x="${(pad.l + w + 8).toFixed(1)}" y="${y + 16}" fill="#4a433c" font-size="12">${esc(formatNum(row.value))}</text>`;
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(chart.title || "Chart")}">
    <title>${esc(chart.title || "Chart")}</title>
    ${bars}
    <text x="${pad.l}" y="${height - 10}" fill="#5c564e" font-size="12">${esc(chart.source || "")}</text>
  </svg>`;
}

function formatNum(value) {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toFixed(1);
}
