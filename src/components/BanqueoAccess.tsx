import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, ChevronRight } from 'lucide-react';
import { getCuentaSession } from '../services/api';
import { TopBar } from './terminal';
import { CuentaBotones } from './CuentaBotones';

/**
 * Acceso al banqueo: se entra con la cuenta de sinapsisedu.com (correo + contraseña).
 * El login de SINAPSIS vuelve a /acceso?ticket=... y desde ahí se abre la sesión.
 */
export function BanqueoAccess() {
  const navigate = useNavigate();
  const cuenta = getCuentaSession();

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
            <p className="text-sm text-muted mt-2">
              Entra con el correo y la contraseña de tu cuenta de sinapsisedu.com.
            </p>

            {cuenta && (
              <div className="mt-6 rounded-control border border-jungle-100 bg-jungle-50 p-4">
                <p className="text-sm text-ink">
                  Ya entraste como <strong>{cuenta.nombre || cuenta.correo}</strong>.
                </p>
                <button onClick={() => navigate('/banqueo/cursos')} className="btn-primary w-full mt-3">
                  Ir a mis cursos
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="mt-6 rounded-control border border-line bg-paper p-4 flex items-start gap-3">
              <Lock className="w-4 h-4 text-jungle-800 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">Exclusivo para alumnos con acceso activo</p>
                <p className="text-xs text-muted mt-1">
                  Tu plan de sinapsisedu.com incluye el banqueo y los simulacros de tu examen.
                </p>
              </div>
            </div>

            <CuentaBotones className="mt-6" />

            <div className="mt-6 pt-5 border-t border-line text-center">
              <p className="text-xs text-muted">¿Solo quieres probar? Tu primer simulacro de cada examen es gratis.</p>
              <button
                onClick={() => navigate('/registro')}
                className="mt-1 min-h-[44px] px-3 text-sm font-semibold text-jungle-600 hover:text-jungle-800"
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
