import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, ChevronRight, ChevronLeft, Loader2, AlertCircle, Mail, Phone, GraduationCap, Stethoscope, MessageCircle, Lock, CheckCircle } from 'lucide-react';
import { useExamStore, useExamCatalog, useSelectedExam } from '../hooks/useExam';
import { validateDNI, validateName } from '../utils/calculations';
import { registerUser, checkAccess, AccessCheckResult } from '../services/api';
import { UNIVERSITIES_BY_REGION } from '../types';
import { ExamSelector } from './ExamSelector';
import { TopBar } from './terminal';

export function StudentForm() {
  const navigate = useNavigate();
  const { setStudent, loadConfig, config, status, error, selectExam } = useExamStore();
  const { exams } = useExamCatalog();
  const exam = useSelectedExam();

  const [dni, setDni] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [university, setUniversity] = useState('');
  const [errors, setErrors] = useState<{ dni?: string; name?: string; email?: string; phone?: string; university?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessCheck, setAccessCheck] = useState<AccessCheckResult | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  // Verificar acceso cuando el DNI tenga 8 dígitos Y el email sea válido
  useEffect(() => {
    const checkUserAccessAsync = async () => {
      const dniValid = dni.length === 8 && validateDNI(dni);
      const emailValid = email.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (dniValid && emailValid) {
        setIsCheckingAccess(true);
        try {
          const result = await checkAccess(dni, email, exam.id);
          // Error de red/servidor (sin intentos ni fraude): no bloquear al alumno con un "ya realizaste 0 intentos"
          const fallaDeConexion = !result.canAccess && !result.isFraudAttempt && !result.attemptCount;
          setAccessCheck(fallaDeConexion ? null : result);
        } catch (err) {
          setAccessCheck(null);
        }
        setIsCheckingAccess(false);
      } else if (dniValid && !emailValid) {
        // Si solo DNI válido, limpiar check anterior pero no verificar aún
        setAccessCheck(null);
      } else {
        setAccessCheck(null);
      }
    };

    const debounceTimer = setTimeout(checkUserAccessAsync, 500);
    return () => clearTimeout(debounceTimer);
  }, [dni, email, exam.id]);

  // Cargar configuración del examen seleccionado
  useEffect(() => {
    if (!config || config.id !== exam.id) {
      loadConfig();
    }
  }, [config, exam.id, loadConfig]);

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return false; // Email es obligatorio
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    if (!phone.trim()) return false; // Phone es obligatorio
    return /^9\d{8}$/.test(phone);
  };

  const validateForm = () => {
    const newErrors: { dni?: string; name?: string; email?: string; phone?: string; university?: string } = {};

    if (!dni.trim()) {
      newErrors.dni = 'El DNI es requerido';
    } else if (!validateDNI(dni)) {
      newErrors.dni = 'El DNI debe tener 8 dígitos';
    }

    if (!fullName.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (!validateName(fullName)) {
      newErrors.name = 'Ingresa un nombre válido (mínimo 3 caracteres)';
    }

    if (!email.trim()) {
      newErrors.email = 'El correo electrónico es requerido';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Ingresa un correo electrónico válido';
    }

    if (!phone.trim()) {
      newErrors.phone = 'El celular es requerido';
    } else if (!validatePhone(phone)) {
      newErrors.phone = 'El celular debe tener 9 dígitos y empezar con 9';
    }

    if (!university) {
      newErrors.university = 'Selecciona tu universidad';
    }

    // Verificar acceso
    if (accessCheck && !accessCheck.canAccess) {
      newErrors.dni = 'Necesitas inscribirte para dar más exámenes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    // Registrar usuario en Google Sheets (en segundo plano, no bloquea)
    try {
      await registerUser({
        dni: dni.trim(),
        fullName: fullName.trim().toUpperCase(),
        email: email.trim().toLowerCase() || '',
        phone: phone.trim() || '',
        university
      });
    } catch (err) {
      // Si falla el registro, continuamos de todos modos (no bloqueamos al usuario)
      console.warn('No se pudo registrar usuario:', err);
    }

    setStudent({
      dni: dni.trim(),
      fullName: fullName.trim().toUpperCase(),
      university
    });

    setIsSubmitting(false);
    navigate('/confirmar');
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-jungle-600 animate-spin mx-auto mb-4" />
            <p className="text-muted">Cargando configuración...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-wrong mx-auto mb-4" />
            <h2 className="title-screen text-xl mb-2">Error de conexión</h2>
            <p className="text-muted mb-6">{error}</p>
            <button onClick={() => loadConfig()} className="btn-primary">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fieldClass = (hasError?: string) =>
    `input ${hasError ? 'border-wrong focus:border-wrong focus:ring-wrong/15' : ''}`;

  const FieldError = ({ message }: { message?: string }) =>
    message ? (
      <p className="text-wrong text-sm mt-2 flex items-center gap-1.5">
        <AlertCircle className="w-4 h-4" />
        {message}
      </p>
    ) : null;

  const blocked = accessCheck !== null && !accessCheck.canAccess;

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <TopBar>
        {exams.length > 1 && (
          <ExamSelector exams={exams} selectedId={exam.id} onSelect={selectExam} />
        )}
      </TopBar>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-8 lg:py-12">
        {/* Cabecera (6.1) */}
        <div className="flex items-start gap-4 mb-6">
          <div className="grid place-items-center w-12 h-12 shrink-0 rounded-control bg-jungle-100 text-jungle-800">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="meta">{exam.nombre} · Simulacro · Paso 1 de 2</p>
            <h1 className="title-screen text-[26px] md:text-[28px] leading-tight mt-1">Tus datos</h1>
          </div>
        </div>

        <div className="card p-6 md:p-8">
          <p className="text-[15px] text-muted mb-6">
            Ingresa tus datos para comenzar el simulacro {exam.nombre}. Los campos con * son obligatorios.
          </p>

          <div className="space-y-5">
            {/* DNI */}
            <div>
              <label className="label" htmlFor="sf-dni">
                <CreditCard className="w-4 h-4 inline mr-2 text-muted" />
                DNI <span className="text-wrong">*</span>
              </label>
              <input
                id="sf-dni"
                type="text"
                inputMode="numeric"
                value={dni}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setDni(value);
                  if (errors.dni) setErrors({ ...errors, dni: undefined });
                }}
                placeholder="8 dígitos"
                className={`${fieldClass(errors.dni)} num`}
                maxLength={8}
              />
              <FieldError message={errors.dni} />
              {isCheckingAccess && (
                <p className="text-muted text-sm mt-2 flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando acceso...
                </p>
              )}
              {accessCheck && !errors.dni && !isCheckingAccess && (
                <p className={`text-sm mt-2 flex items-center gap-1.5 ${accessCheck.canAccess ? 'text-correct' : 'text-wrong'}`}>
                  {accessCheck.canAccess ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {accessCheck.isFirstAttempt ? `Primer simulacro ${exam.nombre} gratuito` : `Acceso confirmado (${accessCheck.attemptCount} intento${accessCheck.attemptCount > 1 ? 's' : ''} previo${accessCheck.attemptCount > 1 ? 's' : ''})`}
                    </>
                  ) : accessCheck.isFraudAttempt ? (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      {accessCheck.reason}
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Ya realizaste {accessCheck.attemptCount} intento{accessCheck.attemptCount > 1 ? 's' : ''} - Inscríbete para continuar
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Nombre */}
            <div>
              <label className="label" htmlFor="sf-name">
                <User className="w-4 h-4 inline mr-2 text-muted" />
                Nombre completo <span className="text-wrong">*</span>
              </label>
              <input
                id="sf-name"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="Nombres y apellidos"
                className={fieldClass(errors.name)}
              />
              <FieldError message={errors.name} />
            </div>

            {/* Universidad */}
            <div>
              <label className="label" htmlFor="sf-uni">
                <GraduationCap className="w-4 h-4 inline mr-2 text-muted" />
                Universidad <span className="text-wrong">*</span>
              </label>
              <select
                id="sf-uni"
                value={university}
                onChange={(e) => {
                  setUniversity(e.target.value);
                  if (errors.university) setErrors({ ...errors, university: undefined });
                }}
                className={fieldClass(errors.university)}
              >
                <option value="">Selecciona tu universidad</option>
                {Object.entries(UNIVERSITIES_BY_REGION).map(([region, universities]) => (
                  <optgroup key={region} label={region}>
                    {universities.map((uni) => (
                      <option key={uni.code} value={uni.code}>
                        {uni.code} - {uni.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="OTRA">Otra universidad</option>
              </select>
              <FieldError message={errors.university} />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {/* Correo */}
              <div>
                <label className="label" htmlFor="sf-email">
                  <Mail className="w-4 h-4 inline mr-2 text-muted" />
                  Correo <span className="text-wrong">*</span>
                </label>
                <input
                  id="sf-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  placeholder="ejemplo@correo.com"
                  className={fieldClass(errors.email)}
                />
                <FieldError message={errors.email} />
              </div>

              {/* Celular */}
              <div>
                <label className="label" htmlFor="sf-phone">
                  <Phone className="w-4 h-4 inline mr-2 text-muted" />
                  Celular <span className="text-wrong">*</span>
                </label>
                <input
                  id="sf-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                    setPhone(value);
                    if (errors.phone) setErrors({ ...errors, phone: undefined });
                  }}
                  placeholder="9XXXXXXXX"
                  className={`${fieldClass(errors.phone)} num`}
                  maxLength={9}
                />
                <FieldError message={errors.phone} />
              </div>
            </div>
          </div>

          {/* Acceso denegado */}
          {blocked && accessCheck && (
            <div className="mt-6 p-4 rounded-control border border-wrong/30 bg-wrong-bg">
              <div className="flex items-start gap-3">
                {accessCheck.isFraudAttempt ? (
                  <AlertCircle className="w-5 h-5 text-wrong mt-0.5 flex-shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-wrong mt-0.5 flex-shrink-0" />
                )}
                <div>
                  {accessCheck.isFraudAttempt ? (
                    <>
                      <p className="text-sm font-semibold text-ink mb-1">{accessCheck.reason}</p>
                      <p className="text-sm text-muted">
                        Por favor utiliza los mismos datos con los que te registraste originalmente.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-ink mb-1">
                        Ya realizaste tu simulacro gratuito de {exam.nombre}
                      </p>
                      <p className="text-sm text-muted mb-3">
                        Para acceder a más simulacros de {exam.nombre}, inscríbete por WhatsApp:
                      </p>
                      <a
                        href="https://wa.link/h2darz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary min-h-[40px] py-2 text-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Solicitar acceso por WhatsApp
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 p-4 rounded-control bg-jungle-50 border border-jungle-100">
            <p className="text-sm text-muted">
              <strong className="text-jungle-800">Tu primer simulacro de {exam.nombre} es gratis.</strong> Para más
              intentos, solicita tu inscripción por WhatsApp:{' '}
              <a
                href="https://wa.link/h2darz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-jungle-600 hover:text-jungle-800 font-semibold underline underline-offset-2"
              >
                Inscríbete aquí
              </a>
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 mt-8">
            <button onClick={() => navigate('/')} className="btn-secondary">
              <ChevronLeft className="w-5 h-5" />
              Volver
            </button>
            <button
              onClick={handleSubmit}
              className="btn-primary"
              disabled={isSubmitting || isCheckingAccess || blocked}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registrando...
                </>
              ) : isCheckingAccess ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verificando...
                </>
              ) : blocked ? (
                <>
                  <Lock className="w-5 h-5" />
                  Acceso restringido
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
