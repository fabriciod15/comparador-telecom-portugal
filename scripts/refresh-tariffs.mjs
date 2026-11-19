import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const tariffsUrl = new URL("tarifarios.json", root);
const statusUrl = new URL("tariff-refresh-status.json", root);

const tariffs = JSON.parse(await readFile(tariffsUrl, "utf8"));
const checkedAt = new Date().toISOString();
const statuses = [];
let updatedCount = 0;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function uniquePrices(text) {
  const prices = [];
  const patterns = [
    /([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*(?:€|eur\b)/gi,
    /(?:€|eur)\s*([0-9]{1,3}(?:[.,][0-9]{1,2})?)\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1].replace(",", ".");
      const price = Number(raw);
      if (Number.isFinite(price) && price >= 1 && price <= 500) {
        prices.push(price);
      }
    }
  }

  return [...new Set(prices)];
}

function markerFor(tariff) {
  const name = normalize(tariff.nome);
  if (tariff.fibra_mbps) {
    if (tariff.fibra_mbps >= 1000) {
      if (tariff.fibra_mbps === 1000) return "1 gbps";
      if (tariff.fibra_mbps === 10000) return "10 gbps";
    }
    return `${tariff.fibra_mbps} mbps`;
  }
  if (tariff.dados_gb) return `${tariff.dados_gb} gb`;
  if (name.includes("ilimitad")) return "ilimitad";
  return name;
}

function findPriceInHtml(html, tariff) {
  const text = normalize(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&euro;/gi, " € ")
    .replace(/[ \t\r\n]+/g, " "));

  const marker = markerFor(tariff);
  let markerIndex = text.indexOf(normalize(marker));

  if (markerIndex < 0 && tariff.dados_gb) {
    markerIndex = text.indexOf(`${tariff.dados_gb} gb`);
  }

  if (markerIndex < 0) return null;

  const start = Math.max(0, markerIndex - 180);
  const end = Math.min(text.length, markerIndex + 260);
  const prices = uniquePrices(text.slice(start, end));
  return prices.length === 1 ? prices[0] : null;
}

async function refreshSource(source, sourceTariffs) {
  let response;
  try {
    response = await fetch(source, {
      headers: {
        "user-agent": "Comparador-Telecom-Portugal/1.0 (+source validation)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    for (const tariff of sourceTariffs) {
      statuses.push({
        source,
        tariff: tariff.nome,
        status: "failed",
        reason: "Página indisponível",
        checkedAt,
      });
    }
    return;
  }

  if (!response.ok) {
    for (const tariff of sourceTariffs) {
      statuses.push({
        source,
        tariff: tariff.nome,
        status: "failed",
        reason: `HTTP ${response.status}`,
        checkedAt,
      });
    }
    return;
  }

  let html;
  try {
    html = await response.text();
  } catch {
    for (const tariff of sourceTariffs) {
      statuses.push({
        source,
        tariff: tariff.nome,
        status: "failed",
        reason: "Resposta não pôde ser lida",
        checkedAt,
      });
    }
    return;
  }

  if (html.length < 500) {
    for (const tariff of sourceTariffs) {
      statuses.push({
        source,
        tariff: tariff.nome,
        status: "failed",
        reason: "Conteúdo insuficiente para confirmar",
        checkedAt,
      });
    }
    return;
  }

  for (const tariff of sourceTariffs) {
    const price = findPriceInHtml(html, tariff);
    if (price == null) {
      statuses.push({
        source,
        tariff: tariff.nome,
        status: "preserved",
        reason: "Preço não confirmado de forma inequívoca",
        checkedAt,
      });
      continue;
    }

    const previousPromo = Number(tariff.mensalidade_promo);
    const previousBase = Number(tariff.mensalidade_base);
    if (tariff.meses_promo > 0) {
      tariff.mensalidade_promo = price;
    } else {
      tariff.mensalidade_promo = price;
      tariff.mensalidade_base = price;
    }

    if (previousPromo !== Number(tariff.mensalidade_promo) ||
        previousBase !== Number(tariff.mensalidade_base)) {
      updatedCount++;
    }

    statuses.push({
      source,
      tariff: tariff.nome,
      status: "updated",
      price,
      checkedAt,
    });
  }
}

const grouped = new Map();
for (const tariff of tariffs) {
  if (!tariff.fonte) continue;
  const sourceTariffs = grouped.get(tariff.fonte) ?? [];
  sourceTariffs.push(tariff);
  grouped.set(tariff.fonte, sourceTariffs);
}

for (const [source, sourceTariffs] of grouped) {
  await refreshSource(source, sourceTariffs);
}

await writeFile(tariffsUrl, `${JSON.stringify(tariffs, null, 2)}\n`);
await writeFile(statusUrl, `${JSON.stringify({
  checkedAt,
  updatedCount,
  tariffs: statuses,
}, null, 2)}\n`);
