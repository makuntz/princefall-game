import { useState, useEffect } from 'react';
import {
  BR_STATE_OPTIONS,
  COUNTRY_OPTIONS,
  normalizeLegacyBrState,
  normalizeLegacyCountry,
} from '@princefall/shared';
import { api } from '../api';
import './game/GameStyles.css';

interface EditProfileProps {
  token: string;
  onBack: () => void;
}

export function EditProfile({ token, onBack }: EditProfileProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState('BR');
  const [stateProvince, setStateProvince] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBrazil = countryCode === 'BR';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/auth/me', { token });
        const u = res.user;
        if (cancelled || !u) return;
        setEmail(u.email ?? '');
        setUsername(u.username ?? '');
        const cc = normalizeLegacyCountry(u.country ?? '') || 'BR';
        setCountryCode(cc);
        const sp =
          cc === 'BR'
            ? normalizeLegacyBrState(u.stateProvince ?? '')
            : (u.stateProvince ?? '');
        setStateProvince(sp);
        setCity(u.city ?? '');
      } catch {
        if (!cancelled) setLoadError('Não foi possível carregar seu perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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

    setSaving(true);
    try {
      await api.patch(
        '/auth/profile',
        {
          username,
          country: countryCode,
          stateProvince: isBrazil ? stateProvince.toUpperCase() : stateProvince.trim(),
          city: city.trim(),
        },
        { token },
      );
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page-inner">
        <div className="auth-card">
          <button
            type="button"
            className="game-list-btn game-list-btn--outline"
            onClick={onBack}
            disabled={saving}
            style={{ marginBottom: '1.25rem', width: '100%' }}
          >
            ← Voltar
          </button>

          <h1 className="auth-title">Meu perfil</h1>
          <p className="auth-subtitle">Nome e localização</p>

          <p className="auth-hint" style={{ marginTop: '-0.25rem' }}>
            O e-mail não pode ser alterado: é usado para entrar na conta.
          </p>

          {loading ? (
            <p className="auth-hint" style={{ marginBottom: 0 }}>
              Carregando perfil…
            </p>
          ) : loadError ? (
            <div className="auth-error">{loadError}</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="auth-fields">
                <div>
                  <label className="auth-field-label" htmlFor="profile-email">
                    E-mail
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    className="auth-input auth-input--readonly"
                    value={email}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                  />
                </div>
                <div>
                  <label className="auth-field-label" htmlFor="profile-username">
                    Nome de usuário
                  </label>
                  <p className="auth-field-micro">2 a 48 caracteres: letras, números, espaço, _ e -</p>
                  <input
                    id="profile-username"
                    type="text"
                    name="username"
                    autoComplete="username"
                    className="auth-input"
                    placeholder="Nome de usuário"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="auth-field-label" htmlFor="profile-country">
                    País
                  </label>
                  <select
                    id="profile-country"
                    name="country"
                    className="auth-input auth-select"
                    value={countryCode}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCountryCode(next);
                      setStateProvince('');
                      setError(null);
                    }}
                    disabled={saving}
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
                    <label className="auth-field-label" htmlFor="profile-state-br">
                      Estado (UF)
                    </label>
                    <select
                      id="profile-state-br"
                      name="stateProvince"
                      className="auth-input auth-select"
                      value={stateProvince}
                      onChange={(e) => {
                        setStateProvince(e.target.value);
                        setError(null);
                      }}
                      disabled={saving}
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
                    <label className="auth-field-label" htmlFor="profile-state-intl">
                      Estado ou província
                    </label>
                    <input
                      id="profile-state-intl"
                      type="text"
                      name="stateProvince"
                      autoComplete="address-level1"
                      className="auth-input"
                      placeholder="Região administrativa"
                      value={stateProvince}
                      onChange={(e) => {
                        setStateProvince(e.target.value);
                        setError(null);
                      }}
                      disabled={saving || !countryCode}
                    />
                  </div>
                )}

                <div>
                  <label className="auth-field-label" htmlFor="profile-city">
                    Cidade
                  </label>
                  <input
                    id="profile-city"
                    type="text"
                    name="city"
                    autoComplete="address-level2"
                    className="auth-input"
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setError(null);
                    }}
                    disabled={saving}
                  />
                </div>
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="auth-submit" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
