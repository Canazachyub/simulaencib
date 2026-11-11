import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Loader2, AlertCircle, Lock, MessageCircle } from 'lucide-react';
import { checkBanqueoAccess } from '../services/api';
import { TopBar } from './terminal';

export function BanqueoAccess() {
  const navigate = useNavigate();
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidDni = dni.length === 8 && /^\d+$/.test(dni);
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = isValidDni && isValidEmail && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const result = await checkBanqueoAccess(dni, email);

      if (result.canAccess) {
        // Store credentials in sessionStorage for course selection
        sessionStorage.setItem('banqueo_dni', dni);
        sessionStorage.setItem('banqueo_email', email);
        navigate('/banqueo/cursos');
      } else {
        setError(result.reason);
      }
    } catch (err) {
      setError('Error de conexión. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <TopBar />

      <main className="flex-1 flex items-start md:items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <button onClick={() => navigate('/banqueo')} className="btn-ghost -ml-3 mb-3">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="card p-6 md:p-8">
            <p className="meta">Banqueo histórico · Acceso</p>
            <h1 className="title-screen text-[28px] mt-1">Ingresa al banqueo</h1>
            <p className="text-sm text-muted mt-2">Usa tu DNI y el correo con el que te inscribiste.</p>

            {/* Info */}
            <div className="mt-6 rounded-control border border-line bg-paper p-4 flex items-start gap-3">
              <Lock className="w-4 h-4 text-jungle-800 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">Exclusivo para usuarios inscritos</p>
                <p className="text-xs text-muted mt-1">
                  El Banqueo Histórico está disponible solo para usuarios que han confirmado su inscripción.
                </p>
                <a
                  href="https://wa.link/h2darz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-jungle-600 hover:text-jungle-800"
                >
                  <MessageCircle className="w-4 h-4" />
                  Inscríbete por WhatsApp
                </a>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="dni" className="label">DNI</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-subtle pointer-events-none" />
                  <input
                    type="text"
                    id="dni"
                    inputMode="numeric"
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="input pl-11 num"
                    placeholder="8 dígitos"
                    maxLength={8}
                  />
                </div>
                {dni && !isValidDni && (
                  <p className="text-xs text-wrong mt-1.5">El DNI debe tener 8 dígitos</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="label">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-subtle pointer-events-none" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-11"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                {email && !isValidEmail && (
                  <p className="text-xs text-wrong mt-1.5">Ingresa un correo válido</p>
                )}
              </div>

              {error && (
                <div className="rounded-control border border-wrong/30 bg-wrong-bg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-wrong shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{error}</p>
                    <p className="text-xs text-muted mt-1">Para acceder al Banqueo Histórico, solicita tu acceso:</p>
                    <a
                      href="https://wa.link/h2darz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-jungle-600 hover:text-jungle-800"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Solicitar acceso por WhatsApp
                    </a>
                  </div>
                </div>
              )}

              <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Verificar acceso'
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-line text-center">
              <p className="text-xs text-muted">¿No tienes acceso? El simulacro gratuito sigue disponible.</p>
              <button
                onClick={() => navigate('/registro')}
                className="mt-1 text-sm font-semibold text-jungle-600 hover:text-jungle-800"
              >
                Ir al simulacro gratuito
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
