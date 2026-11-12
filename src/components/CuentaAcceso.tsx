import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { loginTicket, SINAPSIS_PORTAL_URL } from '../services/api';
import { useExamStore, prepararSimulacroConCuenta } from '../hooks/useExam';
import { TopBar } from './terminal';

/**
 * /acceso?ticket=...&examen=...[&destino=simulacro]
 * Entrada desde sinapsisedu.com (portal o login ?next=banqueo): canjea el ticket de un solo uso por la
 * sesión de la cuenta y lleva al banqueo (o al simulacro pagado si destino=simulacro).
 */
export function CuentaAcceso() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectExam = useExamStore(s => s.selectExam);
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // el ticket sirve una sola vez (StrictMode monta dos veces)
    started.current = true;
    const ticket = params.get('ticket') || '';
    const examen = (params.get('examen') || '').toLowerCase();
    const destino = params.get('destino');
    if (!ticket) {
      setError('Falta el enlace de acceso. Vuelve a entrar desde tu portal de sinapsisedu.com.');
      return;
    }
    loginTicket(ticket)
      .then(cuenta => {
        const examOk = examen && cuenta.exams.includes(examen) ? examen : cuenta.exams[0] || '';
        if (examOk) {
          try { sessionStorage.setItem('banqueo_exam', examOk); } catch { /* sin sessionStorage */ }
          selectExam(examOk);
        }
        if (destino === 'simulacro' && examOk) {
          // Simulacro pagado: sin formulario de DNI (la identidad va en el token de la cuenta)
          if (prepararSimulacroConCuenta(examOk)) navigate(`/confirmar?examen=${encodeURIComponent(examOk)}`, { replace: true });
          else navigate(`/registro?examen=${encodeURIComponent(examOk)}`, { replace: true });
        } else {
          navigate('/banqueo/cursos', { replace: true });
        }
      })
      .catch(err => {
        setError(err instanceof Error && err.message
          ? err.message
          : 'No se pudo verificar tu acceso. Vuelve a entrar desde tu portal.');
      });
  }, [params, navigate, selectExam]);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-start md:items-center justify-center px-4 py-10">
        <div className="w-full max-w-md card p-6 md:p-8">
          {!error ? (
            <div className="text-center py-6" role="status">
              <Loader2 className="w-10 h-10 text-jungle-600 animate-spin mx-auto mb-4" />
              <p className="title-screen text-xl">Abriendo tu banqueo…</p>
              <p className="text-sm text-muted mt-2">Verificando tu cuenta de sinapsisedu.com.</p>
            </div>
          ) : (
            <div role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-wrong shrink-0 mt-0.5" />
                <div>
                  <h1 className="title-screen text-xl">No pudimos abrir tu banqueo</h1>
                  <p className="text-sm text-muted mt-2">{error}</p>
                </div>
              </div>
              <a href={SINAPSIS_PORTAL_URL} className="btn-primary w-full mt-6">
                <ArrowLeft className="w-4 h-4" />
                Volver a mi portal
              </a>
              <button
                onClick={() => navigate('/registro', { replace: true })}
                className="mt-2 w-full min-h-[44px] text-sm font-semibold text-jungle-600 hover:text-jungle-800"
              >
                Ir al simulacro gratuito
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
