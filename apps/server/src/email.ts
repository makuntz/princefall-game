const BREVO_TRANSACTIONAL_URL = 'https://api.brevo.com/v3/smtp/email';

function webOrigin(): string {
  return (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
}

export function buildEmailVerificationUrl(token: string): string {
  return `${webOrigin()}/?verifyEmail=${encodeURIComponent(token)}`;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Formato: "Nome <email@dominio.com>" ou só o e-mail.
 * Em produção, ausência ou formato inválido gera erro explícito.
 */
function parseEmailFromForBrevo(): { name: string; email: string } {
  const raw = process.env.EMAIL_FROM?.trim();
  const prod = isProduction();

  if (!raw) {
    if (prod) {
      throw new Error(
        'EMAIL_FROM não configurada. Defina no formato "Nome <email@dominio.com>" com endereço verificado na Brevo.',
      );
    }
    return { name: 'Queda da coroa', email: 'noreply@localhost' };
  }

  const angle = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    return { name: angle[1].trim() || 'Queda da coroa', email: angle[2].trim() };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { name: 'Queda da coroa', email: raw };
  }

  if (prod) {
    throw new Error(
      'EMAIL_FROM inválido. Use "Nome <email@dominio.com>" ou apenas um e-mail válido.',
    );
  }

  return { name: 'Queda da coroa', email: 'noreply@localhost' };
}

export async function sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      '\n[email] BREVO_API_KEY não definida — link de confirmação (abra no navegador):\n',
      verificationUrl,
      '\n',
    );
    return;
  }

  const sender = parseEmailFromForBrevo();

  const subject = 'Confirme seu e-mail — Queda da coroa';
  const textContent =
    `Olá,\n\nPara confirmar seu cadastro, abra este link no navegador:\n${verificationUrl}\n\n` +
    `Se você não criou conta, ignore este e-mail.`;

  const safeHref = verificationUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const htmlContent =
    `<p>Olá,</p><p><a href="${safeHref}">Confirmar meu e-mail</a></p>` +
    `<p>Se você não criou conta, ignore esta mensagem.</p>`;

  const res = await fetch(BREVO_TRANSACTIONAL_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: to }],
      subject,
      textContent,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    const snippet = bodyText.length > 800 ? `${bodyText.slice(0, 800)}…` : bodyText;
    console.error(`[email] Brevo rejeitou o envio: HTTP ${res.status} ${res.statusText}`);
    console.error('[email] Resposta Brevo (sem secrets):', snippet || '(vazio)');
    throw new Error(`Falha ao enviar e-mail (Brevo HTTP ${res.status}).`);
  }
}
