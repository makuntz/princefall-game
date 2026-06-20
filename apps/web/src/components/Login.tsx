import { useState, useEffect } from 'react';
import {
  BR_STATE_OPTIONS,
  COUNTRY_OPTIONS,
} from '@princefall/shared';
import { api } from '../api';
import { getGoogleLoginUrl } from '../config';
import './game/GameStyles.css';

export interface RegisterPayload {
  email: string;
  username: string;
  country: string;
  stateProvince: string;
  city: string;
  acceptedPrivacyPolicy: boolean;
}

export interface GoogleRegisterPayload {
  pendingToken: string;
  username: string;
  country: string;
  stateProvince: string;
  city: string;
  acceptedPrivacyPolicy: boolean;
}

interface LoginProps {
  onLogin: (email: string) => Promise<void>;
  onRegister: (data: RegisterPayload) => Promise<void>;
  onGoogleRegister?: (data: GoogleRegisterPayload) => Promise<void>;
  googlePendingToken?: string | null;
  sessionBanner?: string | null;
  onDismissSessionBanner?: () => void;
}

export function Login({
  onLogin,
  onRegister,
  onGoogleRegister,
  googlePendingToken,
  sessionBanner,
  onDismissSessionBanner,
}: LoginProps) {
  const googleSignup = !!googlePendingToken;
  const [mode, setMode] = useState<'login' | 'register'>(googleSignup ? 'register' : 'register');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('BR');
  const [stateProvince, setStateProvince] = useState('');
  const [city, setCity] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(
    import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === 'true',
  );
  const [loadingGooglePending, setLoadingGooglePending] = useState(googleSignup);

  useEffect(() => {
    api
      .get('/auth/providers', { skipSessionRedirect: true })
      .then((res: { google?: boolean }) => {
        if (typeof res.google === 'boolean') {
          setGoogleEnabled(res.google);
        }
      })
      .catch(() => {
        /* mantém fallback de env */
      });
  }, []);

  useEffect(() => {
    if (!googlePendingToken) {
      setLoadingGooglePending(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const info = (await api.get(
          `/auth/google/pending?token=${encodeURIComponent(googlePendingToken)}`,
          { skipSessionRedirect: true },
        )) as { email: string; suggestedUsername?: string };
        if (cancelled) return;
        setEmail(info.email);
        if (info.suggestedUsername) {
          setUsername(info.suggestedUsername);
        }
        setMode('register');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sessão Google inválida.');
        }
      } finally {
        if (!cancelled) {
          setLoadingGooglePending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [googlePendingToken]);

  const resetErrorOnChange = () => setError(null);

  const isBrazil = countryCode === 'BR';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um e-mail válido.');
      return;
    }

    if (mode === 'register') {
      if (!acceptedPrivacy) {
        setError('É necessário aceitar o tratamento dos dados conforme descrito na política.');
        return;
      }
      if (!countryCode) {
        setError('Selecione o país.');
        return;
      }
      if (!stateProvince.trim()) {
        setError(isBrazil ? 'Selecione o estado (UF).' : 'Informe o estado ou província.');
        return;
      }
      if (!city.trim()) {
        setError('Informe a cidade.');
        return;
      }
      if (!username.trim()) {
        setError('Informe o nome de usuário.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email);
      } else if (googleSignup && onGoogleRegister && googlePendingToken) {
        await onGoogleRegister({
          pendingToken: googlePendingToken,
          username,
          country: countryCode,
          stateProvince: isBrazil ? stateProvince.toUpperCase() : stateProvince.trim(),
          city: city.trim(),
          acceptedPrivacyPolicy: true,
        });
      } else {
        await onRegister({
          email,
          username,
          country: countryCode,
          stateProvince: isBrazil ? stateProvince.toUpperCase() : stateProvince.trim(),
          city: city.trim(),
          acceptedPrivacyPolicy: true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page-inner">
        <div className="auth-card">
          <h1 className="auth-title">Queda da coroa</h1>
          <p className="auth-subtitle">Jogo de xadrez customizado 9×9</p>

          {sessionBanner && (
            <div className="auth-info" role="status">
              <span>{sessionBanner}</span>
              {onDismissSessionBanner && (
                <button type="button" className="auth-info-dismiss" onClick={onDismissSessionBanner}>
                  ×
                </button>
              )}
            </div>
          )}

          {!googleSignup && (
          <div className="auth-tabs" role="tablist" aria-label="Cadastro ou entrar">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`auth-tab${mode === 'register' ? ' auth-tab--active' : ''}`}
              onClick={() => {
                setMode('register');
                resetErrorOnChange();
              }}
            >
              Cadastro
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab${mode === 'login' ? ' auth-tab--active' : ''}`}
              onClick={() => {
                setMode('login');
                resetErrorOnChange();
              }}
            >
              Entrar
            </button>
          </div>
          )}

          {mode === 'register' && !googleSignup && (
            <p className="auth-hint">
              País e UF/cidade são usados para rankings regionais (armazenados conforme seu aceite).
            </p>
          )}
          {mode === 'register' && googleSignup && (
            <p className="auth-hint">
              Complete seu perfil para finalizar o cadastro com Google. Seu e-mail já foi confirmado
              pela Google.
            </p>
          )}
          {mode === 'login' && (
            <p className="auth-hint">Use o mesmo e-mail do cadastro ou entre com Google.</p>
          )}

          {googleEnabled && mode === 'login' && (
            <>
              <button
                type="button"
                className="auth-google-btn"
                disabled={loading || loadingGooglePending}
                onClick={() => {
                  window.location.href = getGoogleLoginUrl();
                }}
              >
                <span className="auth-google-icon" aria-hidden="true">
                  G
                </span>
                Entrar com Google
              </button>
              <div className="auth-divider">
                <span>ou</span>
              </div>
            </>
          )}

          {loadingGooglePending ? (
            <p className="auth-hint">Carregando dados da conta Google…</p>
          ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-fields">
              <div>
                <label className="auth-field-label" htmlFor="auth-email">
                  E-mail
                </label>
                <input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  className={`auth-input${googleSignup ? ' auth-input--readonly' : ''}`}
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    resetErrorOnChange();
                  }}
                  disabled={loading || googleSignup}
                  readOnly={googleSignup}
                />
              </div>

              {mode === 'register' && (
                <>
                  <div>
                    <label className="auth-field-label" htmlFor="auth-username">
                      Nome de usuário
                    </label>
                    <p className="auth-field-micro">2 a 48 caracteres: letras, números, espaço, _ e -</p>
                    <input
                      id="auth-username"
                      type="text"
                      name="username"
                      autoComplete="username"
                      className="auth-input"
                      placeholder="Como quer ser chamado no jogo"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        resetErrorOnChange();
                      }}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="auth-field-label" htmlFor="auth-country">
                      País
                    </label>
                    <select
                      id="auth-country"
                      name="country"
                      className="auth-input auth-select"
                      value={countryCode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCountryCode(next);
                        setStateProvince('');
                        resetErrorOnChange();
                      }}
                      disabled={loading}
                    >
                      <option value="">— Selecione —</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.namePt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isBrazil ? (
                    <div>
                      <label className="auth-field-label" htmlFor="auth-state-br">
                        Estado (UF)
                      </label>
                      <select
                        id="auth-state-br"
                        name="stateProvince"
                        className="auth-input auth-select"
                        value={stateProvince}
                        onChange={(e) => {
                          setStateProvince(e.target.value);
                          resetErrorOnChange();
                        }}
                        disabled={loading}
                      >
                        <option value="">— UF —</option>
                        {BR_STATE_OPTIONS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.code} — {s.namePt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="auth-field-label" htmlFor="auth-state-intl">
                        Estado ou província
                      </label>
                      <input
                        id="auth-state-intl"
                        type="text"
                        name="stateProvince"
                        autoComplete="address-level1"
                        className="auth-input"
                        placeholder="Região administrativa"
                        value={stateProvince}
                        onChange={(e) => {
                          setStateProvince(e.target.value);
                          resetErrorOnChange();
                        }}
                        disabled={loading || !countryCode}
                      />
                    </div>
                  )}

                  <div>
                    <label className="auth-field-label" htmlFor="auth-city">
                      Cidade
                    </label>
                    <input
                      id="auth-city"
                      type="text"
                      name="city"
                      autoComplete="address-level2"
                      className="auth-input"
                      placeholder="Ex.: Porto Ferreira"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        resetErrorOnChange();
                      }}
                      disabled={loading}
                    />
                  </div>

                  <div className="auth-lgpd-block">
                    <label className="auth-lgpd-row">
                      <input
                        type="checkbox"
                        checked={acceptedPrivacy}
                        onChange={(e) => {
                          setAcceptedPrivacy(e.target.checked);
                          resetErrorOnChange();
                        }}
                        disabled={loading}
                      />
                      <span>
                        Li e aceito o tratamento dos meus dados pessoais e de localização para fins de jogo e
                        rankings regionais, conforme o resumo abaixo (LGPD).
                      </span>
                    </label>
                    <details className="auth-lgpd-details">
                      <summary>Resumo da política de privacidade</summary>
                      <div className="auth-lgpd-body">
                        <p>
                          Coletamos e-mail (login), nome público no jogo e localização (país, estado, cidade)
                          informados por você. Usamos esses dados para conta, partidas online e futuros rankings
                          por região. Você pode atualizar nome e localização em «Meu perfil». O e-mail não é
                          alterado pelo app. Em caso de dúvidas sobre seus dados, use o contato do responsável
                          pelo serviço quando disponível.
                        </p>
                      </div>
                    </details>
                  </div>
                </>
              )}
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit" disabled={loading || loadingGooglePending}>
              {loading
                ? 'Aguarde…'
                : googleSignup
                  ? 'Concluir cadastro'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}
