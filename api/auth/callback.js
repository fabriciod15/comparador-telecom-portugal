export default async function handler(req, res) {
  const crypto = await import("node:crypto");
  const code = req.query.code;
  const state = req.query.state;
  const cookies = req.headers.cookie || "";
  const stateCookie = cookies.match(/(?:^|;\s*)telecom_oauth_state=([^;]+)/)?.[1];

  if (!code || !state || state !== stateCookie) {
    return res.status(400).send("Estado OAuth inválido");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).send("OAuth não configurado");

  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/callback/github`;
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return res.status(401).send("Falha na autenticação GitHub");

  const userResponse = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${tokenData.access_token}`, "Accept": "application/vnd.github+json", "User-Agent": "telecom-admin" }
  });
  const user = await userResponse.json();
  const allowed = (process.env.ADMIN_GITHUB_USERS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.includes(user.login)) return res.status(403).send("Conta não autorizada");

  const payload = Buffer.from(JSON.stringify({
    login: user.login,
    accessToken: tokenData.access_token,
    exp: Date.now() + 8 * 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", clientSecret).update(payload).digest("base64url");
  res.setHeader("Set-Cookie", [
    "telecom_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    `telecom_session=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`
  ]);
  res.redirect("/admin.html");
}
