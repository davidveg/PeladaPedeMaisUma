import nodemailer from "nodemailer";

export function createSmtpMailer(environment = process.env) {
  const host = environment.SMTP_HOST?.trim();
  const port = Number.parseInt(environment.SMTP_PORT ?? "465", 10);
  const user = environment.SMTP_USER?.trim();
  const password = environment.SMTP_PASSWORD?.trim();
  const from = environment.SMTP_FROM?.trim() || user;
  const baseUrl = environment.APP_BASE_URL?.trim().replace(/\/$/, "");
  const jsonTransport = String(environment.SMTP_JSON_TRANSPORT ?? "false").toLowerCase() === "true";
  let publicBaseUrl;
  try {
    const parsed = new URL(baseUrl);
    if (jsonTransport || parsed.protocol === "https:") publicBaseUrl = parsed.toString().replace(/\/$/, "");
  } catch {}
  const configured = Boolean(publicBaseUrl && from && (jsonTransport || (host && Number.isFinite(port) && user && password)));

  if (!configured) {
    return {
      configured: false,
      async sendPasswordReset() { throw new Error("SMTP ou APP_BASE_URL não configurado."); },
    };
  }

  const secure = String(environment.SMTP_SECURE ?? (port === 465)).toLowerCase() === "true";
  const smtpOptions = {
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass: password },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  };
  const transporter = nodemailer.createTransport(jsonTransport ? { jsonTransport: true } : smtpOptions);

  return {
    configured: true,
    async sendPasswordReset({ to, token }) {
      const resetUrl = new URL("/admin", publicBaseUrl);
      resetUrl.searchParams.set("reset", token);
      const result = await transporter.sendMail({
        from,
        to,
        subject: "Redefinição de senha — Pelada Pede Mais Uma",
        text: `Recebemos uma solicitação para redefinir sua senha administrativa. Abra o link abaixo em até 30 minutos:\n\n${resetUrl}\n\nSe você não solicitou esta alteração, ignore este e-mail.`,
        html: `<div style="font-family:Arial,sans-serif;color:#15241f;line-height:1.6"><h2 style="color:#174d3b">Pelada Pede Mais Uma</h2><p>Recebemos uma solicitação para redefinir sua senha administrativa.</p><p><a href="${resetUrl}" style="display:inline-block;background:#174d3b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Criar nova senha</a></p><p>Este link expira em 30 minutos e pode ser usado uma única vez.</p><p style="color:#68756f;font-size:13px">Se você não solicitou esta alteração, ignore este e-mail.</p></div>`,
      });
      return { messageId: result.messageId };
    },
  };
}
