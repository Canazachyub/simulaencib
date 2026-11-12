import { LogIn } from 'lucide-react';
import clsx from 'clsx';
import { SINAPSIS_LOGIN_BANQUEO_URL, SINAPSIS_PLANES_URL } from '../services/api';

/**
 * Las dos salidas para quien no tiene sesión de la cuenta: entrar con la cuenta de sinapsisedu.com
 * (vuelve al banqueo con un ticket) o ver los planes.
 */
export function CuentaBotones({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <a href={SINAPSIS_LOGIN_BANQUEO_URL} className={clsx('btn-primary w-full', compact && 'py-2 text-sm')}>
        <LogIn className="w-4 h-4" />
        Entrar con mi cuenta SINAPSIS
      </a>
      <a
        href={SINAPSIS_PLANES_URL}
        className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-jungle-600 hover:text-jungle-800"
      >
        ¿Aún no tienes acceso? Ver planes
      </a>
    </div>
  );
}
