export default function handler(req, res) {
  res.setHeader("Set-Cookie", "telecom_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  res.redirect("/admin.html");
}
