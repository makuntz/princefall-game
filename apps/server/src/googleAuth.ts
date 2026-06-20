import { FastifyInstance } from 'fastify';
import oauthPlugin from '@fastify/oauth2';
import type { OAuth2Namespace } from '@fastify/oauth2/types';

const GOOGLE_PROVIDER = 'google';

export function isGoogleAuthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function webOrigin() {
  return process.env.WEB_ORIGIN || 'http://localhost:3000';
}

function apiOrigin() {
  return process.env.API_ORIGIN || 'http://localhost:3001';
}

function redirectWithError(reply: any, message: string) {
  const url = new URL(webOrigin());
  url.searchParams.set('authError', message);
  return reply.redirect(url.toString());
}

function suggestUsername(name: string | undefined, email: string) {
  const fromName = (name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48);
  if (fromName.length >= 2 && /^[\p{L}\p{N} _-]+$/u.test(fromName)) {
    return fromName.toLowerCase();
  }
  const local = email.split('@')[0] ?? 'jogador';
  const cleaned = local.replace(/[^a-zA-Z0-9 _-]/g, '_').slice(0, 48);
  return cleaned.length >= 2 ? cleaned.toLowerCase() : 'jogador';
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Não foi possível obter dados da conta Google.');
  }
  const data = (await res.json()) as Record<string, unknown>;
  const sub = typeof data.sub === 'string' ? data.sub : '';
  const email = typeof data.email === 'string' ? data.email : '';
  if (!sub || !email) {
    throw new Error('Conta Google sem e-mail válido.');
  }
  return {
    sub,
    email,
    email_verified: data.email_verified === true,
    name: typeof data.name === 'string' ? data.name : undefined,
  };
}

export async function resolveGoogleUser(
  fastify: FastifyInstance,
  googleUser: GoogleUserInfo,
): Promise<
  | { kind: 'login'; userId: string; email: string }
  | { kind: 'register'; pendingToken: string }
> {
  const existingIdentity = await fastify.prisma.authIdentity.findUnique({
    where: {
      provider_providerId: {
        provider: GOOGLE_PROVIDER,
        providerId: googleUser.sub,
      },
    },
    include: { user: true },
  });

  if (existingIdentity) {
    return {
      kind: 'login',
      userId: existingIdentity.user.id,
      email: existingIdentity.user.email,
    };
  }

  const userByEmail = await fastify.prisma.user.findUnique({
    where: { email: googleUser.email },
  });

  if (userByEmail) {
    await fastify.prisma.authIdentity.create({
      data: {
        userId: userByEmail.id,
        provider: GOOGLE_PROVIDER,
        providerId: googleUser.sub,
        email: googleUser.email,
      },
    });

    if (googleUser.email_verified && !userByEmail.emailVerifiedAt) {
      await fastify.prisma.user.update({
        where: { id: userByEmail.id },
        data: {
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
        },
      });
    }

    return {
      kind: 'login',
      userId: userByEmail.id,
      email: userByEmail.email,
    };
  }

  const pendingToken = fastify.jwt.sign(
    {
      purpose: 'google-pending',
      sub: googleUser.sub,
      email: googleUser.email,
      suggestedUsername: suggestUsername(googleUser.name, googleUser.email),
    },
    { expiresIn: '15m' },
  );

  return { kind: 'register', pendingToken };
}

function googleOAuth(fastify: FastifyInstance): OAuth2Namespace {
  return (fastify as FastifyInstance & { googleOAuth2: OAuth2Namespace }).googleOAuth2;
}

export async function registerGoogleAuthRoutes(fastify: FastifyInstance) {
  if (!isGoogleAuthConfigured()) {
    return;
  }

  await fastify.register(oauthPlugin, {
    name: 'googleOAuth2',
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID!,
        secret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/google',
    callbackUri: `${apiOrigin()}/api/auth/google/callback`,
    scope: ['openid', 'profile', 'email'],
  });

  fastify.get('/google/callback', async (request, reply) => {
    try {
      const { token } =
        await googleOAuth(fastify).getAccessTokenFromAuthorizationCodeFlow(request);
      const googleUser = await fetchGoogleUserInfo(token.access_token);
      const result = await resolveGoogleUser(fastify, googleUser);

      const redirectUrl = new URL(webOrigin());

      if (result.kind === 'login') {
        const jwtToken = fastify.jwt.sign({
          userId: result.userId,
          email: result.email,
        });
        redirectUrl.hash = `authToken=${encodeURIComponent(jwtToken)}`;
        return reply.redirect(redirectUrl.toString());
      }

      redirectUrl.hash = `pendingGoogle=${encodeURIComponent(result.pendingToken)}`;
      return reply.redirect(redirectUrl.toString());
    } catch (err) {
      fastify.log.error(err);
      const message =
        err instanceof Error ? err.message : 'Falha ao entrar com Google. Tente novamente.';
      return redirectWithError(reply, message);
    }
  });
}
