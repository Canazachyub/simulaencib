import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowLeft, User, Mail, Loader2, AlertCircle, Lock, CheckCircle, MessageCircle } from 'lucide-react';
import { checkBanqueoAccess } from '../services/api';

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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-700 to-purple-800">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-4">
          <button
            onClick={() => navigate('/banqueo')}
            className="flex items-center gap-2 text-purple-200 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl mb-4">
                  <Brain className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                  Banqueo Histórico
                </h1>
                <p className="text-slate-600 text-sm">
                  Ingresa tus datos para acceder
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">
                      Exclusivo para usuarios inscritos
                    </p>
                    <p className="text-xs text-amber-700 mt-1 mb-3">
                      El Banqueo Histórico está disponible solo para usuarios que han confirmado su inscripción.
                    </p>
                    <a
                      href="https://wa.link/h2darz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Inscríbete por WhatsApp
                    </a>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* DNI */}
                <div>
                  <label htmlFor="dni" className="block text-sm font-medium text-slate-700 mb-1">
                    DNI
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      id="dni"
                      value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="input pl-10 w-full"
                      placeholder="Ingresa tu DNI (8 dígitos)"
                      maxLength={8}
                    />
                  </div>
                  {dni && !isValidDni && (
                    <p className="text-xs text-red-500 mt-1">El DNI debe tener 8 dígitos</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input pl-10 w-full"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  {email && !isValidEmail && (
                    <p className="text-xs text-red-500 mt-1">Ingresa un correo válido</p>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                        <p className="text-xs text-red-600 mt-2 mb-3">
                          Para acceder al Banqueo Histórico, inscríbete por WhatsApp:
                        </p>
                        <a
                          href="https://wa.link/h2darz"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Solicitar acceso por WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Verificar acceso
                    </>
                  )}
                </button>
              </form>

              {/* Help Text */}
              <div className="mt-6 text-center">
                <p className="text-xs text-slate-500">
                  ¿No tienes acceso? El simulacro gratuito sigue disponible.
                </p>
                <button
                  onClick={() => navigate('/registro')}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-2"
                >
                  Ir al Simulacro Gratuito
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-4 text-center">
          <p className="text-sm text-purple-200">
            SimulaENCIB - Banqueo Histórico
          </p>
        </footer>
      </div>
    </div>
  );
}
