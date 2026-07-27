const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let transportador = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transportador = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function enviarCorreo({ to, subject, message, link }) {
  if (!transportador || !to) return;

  const urlCompleta = link ? `${process.env.FRONTEND_URL || ''}${link}` : null;

  try {
    await transportador.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: `Intranet ESPAC — ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1c1c1e; max-width: 480px;">
          <h2 style="margin-bottom: 4px;">${subject}</h2>
          <p style="font-size: 14px;">${message}</p>
          ${urlCompleta ? `<p><a href="${urlCompleta}" style="background:#1c2b4a;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;">Ver en la intranet</a></p>` : ''}
          <p style="font-size: 11px; color: #6b6b70; margin-top: 24px;">Este es un correo automático de la Intranet ESPAC.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('No se pudo enviar el correo:', err.message);
  }
}

module.exports = { enviarCorreo };
