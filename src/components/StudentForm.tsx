import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, ChevronRight, ChevronLeft, Loader2, AlertCircle, Mail, Phone, GraduationCap, Stethoscope, MessageCircle, Lock } from 'lucide-react';
import { useExamStore, useExamCatalog, useSelectedExam } from '../hooks/useExam';
import { validateDNI, validateName } from '../utils/calculations';
import { registerUser, checkAccess, AccessCheckResult } from '../services/api';
import { UNIVERSITIES_BY_REGION, SITE_NAME } from '../types';
import { ExamSelector } from './ExamSelector';

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
          setAccessCheck(result);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error de conexión</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button onClick={() => loadConfig()} className="btn-primary bg-cyan-600 hover:bg-cyan-700">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 text-cyan-600 rounded-2xl mb-4">
            <Stethoscope className="w-8 h-8" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600 mb-1">
            {SITE_NAME}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
            Simulacro {exam.nombre}
          </h1>
          <p className="text-slate-600">
            Ingresa tus datos para comenzar el simulacro
          </p>
        </div>

        {exams.length > 1 && (
          <div className="mb-6">
            <p className="text-sm text-slate-600 mb-2 text-center">Examen a simular</p>
            <ExamSelector
              exams={exams}
              selectedId={exam.id}
              onSelect={selectExam}
              variant="light"
            />
          </div>
        )}

        <div className="card p-8 animate-fade-in">
          <div className="space-y-6">
            {/* DNI Field */}
            <div>
              <label className="label">
                <CreditCard className="w-4 h-4 inline mr-2" />
                DNI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={dni}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setDni(value);
                  if (errors.dni) setErrors({ ...errors, dni: undefined });
                }}
                placeholder="Ingresa tu DNI (8 dígitos)"
                className={`input ${errors.dni ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                maxLength={8}
              />
              {errors.dni && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.dni}
                </p>
              )}
              {isCheckingAccess && (
                <p className="text-slate-500 text-sm mt-2 flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando acceso...
                </p>
              )}
              {accessCheck && !errors.dni && !isCheckingAccess && (
                <p className={`text-sm mt-2 flex items-center gap-1 ${accessCheck.canAccess ? 'text-green-600' : 'text-red-500'}`}>
                  {accessCheck.canAccess ? (
                    <>
                      <span className="w-4 h-4 flex items-center justify-center">✓</span>
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

            {/* Name Field */}
            <div>
              <label className="label">
                <User className="w-4 h-4 inline mr-2" />
                Nombre Completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="Ingresa tu nombre completo"
                className={`input ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* University Field */}
            <div>
              <label className="label">
                <GraduationCap className="w-4 h-4 inline mr-2" />
                Universidad <span className="text-red-500">*</span>
              </label>
              <select
                value={university}
                onChange={(e) => {
                  setUniversity(e.target.value);
                  if (errors.university) setErrors({ ...errors, university: undefined });
                }}
                className={`input ${errors.university ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              >
                <option value="">-- Selecciona tu universidad --</option>
                {Object.entries(UNIVERSITIES_BY_REGION).map(([region, universities]) => (
                  <optgroup key={region} label={`📍 ${region}`}>
                    {universities.map((uni) => (
                      <option key={uni.code} value={uni.code}>
                        {uni.code} - {uni.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="OTRA">Otra universidad</option>
              </select>
              {errors.university && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.university}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label className="label">
                <Mail className="w-4 h-4 inline mr-2" />
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                placeholder="ejemplo@correo.com"
                className={`input ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone Field */}
            <div>
              <label className="label">
                <Phone className="w-4 h-4 inline mr-2" />
                Celular <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                  setPhone(value);
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                placeholder="9XXXXXXXX (9 dígitos)"
                className={`input ${errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                maxLength={9}
              />
              {errors.phone && (
                <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.phone}
                </p>
              )}
            </div>
          </div>

          {/* Access denied message */}
          {accessCheck && !accessCheck.canAccess && (
            <div className="mt-6 p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-start gap-3">
                {accessCheck.isFraudAttempt ? (
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Lock className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  {accessCheck.isFraudAttempt ? (
                    <>
                      <p className="text-sm font-semibold text-red-800 mb-2">
                        {accessCheck.reason}
                      </p>
                      <p className="text-sm text-red-700 mb-3">
                        Por favor utiliza los mismos datos con los que te registraste originalmente.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-red-800 mb-2">
                        Ya realizaste tu simulacro gratuito de {exam.nombre}
                      </p>
                      <p className="text-sm text-red-700 mb-3">
                        Para acceder a más simulacros de {exam.nombre}, inscríbete por WhatsApp:
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
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info box */}
          <div className="mt-6 p-4 bg-cyan-50 rounded-xl border border-cyan-100">
            <p className="text-sm text-cyan-800">
              <strong>Tu primer simulacro de {exam.nombre} es GRATIS.</strong> Para acceder a más intentos,
              solicita tu inscripción por WhatsApp:{' '}
              <a
                href="https://wa.link/h2darz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-700 font-semibold underline"
              >
                Inscríbete aquí
              </a>
            </p>
          </div>

          <div className="flex justify-between mt-8">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              <ChevronLeft className="w-5 h-5" />
              Volver
            </button>
            <button
              onClick={handleSubmit}
              className={`btn-primary ${accessCheck && !accessCheck.canAccess ? 'bg-slate-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700'}`}
              disabled={isSubmitting || isCheckingAccess || (accessCheck !== null && !accessCheck.canAccess)}
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
              ) : accessCheck && !accessCheck.canAccess ? (
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
      </div>
    </div>
  );
}
