export default function handler(req, res) {
  const crypto = require("node:crypto");
  const state = crypto.randomBytes(24).toString("hex");
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).send("GITHUB_CLIENT_ID não configurado");

  res.setHeader("Set-Cookie", `telecom_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
}
