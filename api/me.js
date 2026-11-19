export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)telecom_session=([^;]+)/);
  if (!match) return res.status(401).json({ authenticated: false });

  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret) return res.status(500).json({ error: "OAuth não configurado" });

  const crypto = await import("node:crypto");
  const [payload, signature] = decodeURIComponent(match[1]).split(".");
  if (!payload || !signature) return res.status(401).json({ authenticated: false });
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.exp < Date.now()) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, login: session.login });
  } catch {
    return res.status(401).json({ authenticated: false });
  }
}
