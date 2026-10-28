import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const MEDIA = "/cursor/stores/self/media";
const OUT = join(ROOT, "public", "logos");

const STYLE =
  "A single flat geometric logo mark centered on a warm ivory square background. Printmaking style, thick confident shapes, no gradients, no shadows, no 3D, no letters, no numbers, no words, no watermark, no mockup. Generous empty margin around the symbol. Limited palette of ink black and one accent color.";

const MARKS = [
  ["notchday", `${STYLE} Accent copper. Only one shape: a horizontal rectangle with a small triangular notch cut down from the top center. No second shape, no curve, no letter, no U, no smile.`],
  ["yapmark", `${STYLE} Accent copper. Two overlapping speech balloons, simplified to flat shapes, with no letters inside.`],
  ["flinttable", `${STYLE} Accent amber. A low table seen from the side with one flint spark above it.`],
  ["chartslate", `${STYLE} Accent slate blue. A stone slab with three ascending bars cut into its face.`],
];

loadEnv();
const key = process.env.RFAB_API_KEY;
if (!key) {
  console.error("RFAB_API_KEY is not set. Logo slots stay empty until the key is available.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(MEDIA, { recursive: true });

const saved = await Promise.all(MARKS.map(async ([name, prompt]) => saveLogo(name, await generate(key, prompt))));
let missing = 0;
for (const item of saved) {
  const siteOk = existsSync(item.sitePath) && statSync(item.sitePath).size > 1000;
  const mediaOk = existsSync(item.mediaPath) && statSync(item.mediaPath).size > 1000;
  console.log(`${item.name} site=${siteOk} media=${mediaOk} bytes=${item.bytes}`);
  if (!siteOk || !mediaOk) missing += 1;
}
if (missing) process.exit(1);

async function saveLogo(name, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Logo download failed (${response.status})`);
  const png = toPng(Buffer.from(await response.arrayBuffer()), name);
  if (png.length < 1000 || png[0] !== 0x89 || png[1] !== 0x50) throw new Error(`${name} did not become a PNG`);
  const sitePath = join(OUT, `${name}.png`);
  const mediaPath = join(MEDIA, `${name}.png`);
  writeFileSync(sitePath, png);
  copyFileSync(sitePath, mediaPath);
  return { name, sitePath, mediaPath, bytes: png.length };
}

function toPng(bytes, name) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return bytes;
  const dir = mkdtempSync(join(tmpdir(), "daymark-logo-"));
  const src = join(dir, "in.img");
  const dest = join(dir, "out.png");
  try {
    writeFileSync(src, bytes);
    const run = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, dest], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(redact(run.stderr || `${name} could not be converted to PNG`));
    return readFileSync(dest);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function generate(apiKey, prompt) {
  const started = await fetch("https://api.rfab.ai/api/image-generation/generate", {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      modelId: "openai:gpt-image-2",
      width: 1024,
      height: 1024,
      async: true,
    }),
  });
  const job = await started.json();
  if (!started.ok || !job.jobId) throw new Error(redact(job.error || `Logo request failed (${started.status})`));
  let etaAt = job.etaAt ? Date.parse(job.etaAt) : Date.now() + 3000;
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const waitMs = Math.min(Math.max((Number.isFinite(etaAt) ? etaAt : Date.now() + 3000) - Date.now(), 1500), 8000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const polled = await fetch(`https://api.rfab.ai/api/image-generation/job/${job.jobId}`, {
      headers: { "X-API-Key": apiKey },
    });
    const body = await polled.json();
    if (body.status === "failed") throw new Error(redact(body.error || "Logo job failed"));
    const imageUrl = body.result?.imageUrl || body.imageUrl || body.result?.images?.[0];
    if (body.status === "completed" && imageUrl) return imageUrl;
    if (body.etaAt) etaAt = Date.parse(body.etaAt);
  }
  throw new Error("Logo job timed out");
}

function redact(value) {
  return String(value).replace(/rfab_[A-Za-z0-9]+/g, "rfab_[redacted]");
}

function loadEnv() {
  try {
    const text = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*RFAB_API_KEY\s*=\s*(.*)\s*$/);
      if (!match || process.env.RFAB_API_KEY) continue;
      process.env.RFAB_API_KEY = match[1].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env is optional.
  }
}
