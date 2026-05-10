import nodemailer from 'nodemailer';

function webOrigin(): string {
  return (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
}

export function buildEmailVerificationUrl(token: string): string {
  return `${webOrigin()}/?verifyEmail=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn(
      '\n[email] Nenhum SMTP configurado (defina SMTP_HOST em apps/server/.env).\n' +
        'Link de confirmação (abra no navegador ou copie para localhost):\n',
      verificationUrl,
      '\n',
    );
    return;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  const from = process.env.SMTP_FROM || 'noreply@localhost';

  await transporter.sendMail({
    from,
    to,
    subject: 'Confirme seu e-mail — Queda da coroa',
    text: `Olá,\n\nPara confirmar seu cadastro, abra este link no navegador:\n${verificationUrl}\n\nSe você não criou conta, ignore este e-mail.`,
    html: `<p>Olá,</p><p><a href="${verificationUrl}">Confirmar meu e-mail</a></p><p>Se você não criou conta, ignore esta mensagem.</p>`,
  });
}
