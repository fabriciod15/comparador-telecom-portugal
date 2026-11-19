export default async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", "PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)telecom_session=([^;]+)/);
  if (!match) return res.status(401).json({ error: "Autenticação necessária" });

  const secret = process.env.GITHUB_CLIENT_SECRET;
  const crypto = await import("node:crypto");
  const [payload, signature] = decodeURIComponent(match[1]).split(".");
  if (!payload || !signature) return res.status(401).json({ error: "Sessão inválida" });
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: "Sessão inválida" });
  }
  let session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return res.status(401).json({ error: "Sessão inválida" });
  }
  if (session.exp < Date.now()) return res.status(401).json({ error: "Sessão expirada" });
  const allowed = (process.env.ADMIN_GITHUB_USERS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(session.login)) return res.status(403).json({ error: "Conta não autorizada" });

  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Formato inválido" });
  const owner = process.env.GITHUB_OWNER || "fabriciod15";
  const repo = process.env.GITHUB_REPO || "comparador-telecomunicacoes-portugal";
  const token = process.env.GITHUB_TOKEN;
  if (!owner || !repo || !token) return res.status(500).json({ error: "GitHub não configurado" });

  const fileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/tarifarios.json`;
  const currentResponse = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "telecom-admin" } });
  const current = currentResponse.ok ? await currentResponse.json() : null;
  const content = Buffer.from(JSON.stringify(req.body, null, 2)).toString("base64");
  const body = { message: "Atualizar tarifários pelo painel administrativo", content, ...(current?.sha ? { sha: current.sha } : {}) };
  const saveResponse = await fetch(fileUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "telecom-admin" },
    body: JSON.stringify(body)
  });
  if (!saveResponse.ok) {
    const detail = await saveResponse.json();
    return res.status(saveResponse.status).json({ error: detail.message || "Falha ao publicar" });
  }
  return res.status(200).json({ ok: true });
}
