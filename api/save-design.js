export default async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)telecom_session=([^;]+)/);
  if (!match) return res.status(401).json({ error: "Autenticação necessária" });

  const secret = process.env.GITHUB_CLIENT_SECRET;
  const crypto = await import("node:crypto");
  const [payload, signature] = decodeURIComponent(match[1]).split(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!payload || !signature) return res.status(401).json({ error: "Sessão inválida" });
  if (Buffer.from(signature).length !== Buffer.from(expected).length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: "Sessão inválida" });
  }

  let session;
  try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { return res.status(401).json({ error: "Sessão inválida" }); }
  if (session.exp < Date.now()) return res.status(401).json({ error: "Sessão expirada" });

  const allowed = (process.env.ADMIN_GITHUB_USERS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(session.login)) return res.status(403).json({ error: "Conta não autorizada" });
  if (!req.body || typeof req.body !== "object") return res.status(400).json({ error: "Formato inválido" });

  const owner = "fabriciod15";
  const repo = "comparador-telecomunicacoes-portugal";
  const token = process.env.GITHUB_TOKEN || session.accessToken;
  if (!owner || !repo || !token) return res.status(500).json({ error: "GitHub não configurado. Inicie sessão novamente." });

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/design.json`;
  const current = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "telecom-admin" } });
  const currentData = current.ok ? await current.json() : null;
  const content = Buffer.from(JSON.stringify(req.body, null, 2)).toString("base64");
  const response = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "telecom-admin" },
    body: JSON.stringify({ message: "Atualizar design do website", content, ...(currentData?.sha ? { sha: currentData.sha } : {}) })
  });
  if (!response.ok) return res.status(response.status).json({ error: "Falha ao publicar o design" });
  return res.status(200).json({ ok: true });
}
