import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, ChevronRight, ChevronLeft, Loader2, AlertCircle, Mail, Phone, GraduationCap, Stethoscope } from 'lucide-react';
import { useExamStore } from '../hooks/useExam';
import { validateDNI, validateName } from '../utils/calculations';
import { registerUser } from '../services/api';
import { UNIVERSITIES_BY_REGION, ALL_UNIVERSITIES } from '../types';

export function StudentForm() {
  const navigate = useNavigate();
  const { setStudent, loadConfig, config, status, error } = useExamStore();

  const [dni, setDni] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [university, setUniversity] = useState('');
  const [errors, setErrors] = useState<{ dni?: string; name?: string; email?: string; phone?: string; university?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar configuración al montar
  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
            SimulaENCIB
          </h1>
          <p className="text-slate-600">
            Ingresa tus datos para comenzar el simulacro
          </p>
        </div>

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

          {/* Info box */}
          <div className="mt-6 p-4 bg-cyan-50 rounded-xl border border-cyan-100">
            <p className="text-sm text-cyan-800">
              <strong>Nota:</strong> Tu DNI se usa para identificar tu historial de simulacros.
              Todos los campos son obligatorios.
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
              className="btn-primary bg-cyan-600 hover:bg-cyan-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registrando...
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
