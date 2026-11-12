/**
 * SimulaENCIB / SINAPSIS — API REST multi-examen para Google Apps Script
 *
 * Exámenes: ENCIB, ENAM, Residentado (RM), SERUMS (ENCAPS) e Internado EsSalud.
 *
 * Cada examen vive en su propio Google Sheets con el mismo formato:
 *   - Configuración_<EXAMEN>: COD. | CURSO | N° PREGUNTAS | PUNTOS POR PREGUNTA | HOJAS BANCO | STOCK
 *       "HOJAS BANCO" = hojas Banco_* (separadas por coma) de donde se sacan las preguntas de esa fila.
 *   - Banco_<curso>: Question Text | Question Type | Option 1..5 | Correct Answer | Time in seconds |
 *       Image Link | JUSTIFICACION | NUMERO | CURSO | TEMA | SUBTEMA | NOMBRE DEL ARCHIVO
 * Para cambiar cuántas preguntas salen por curso basta con editar la hoja Configuración_<EXAMEN>.
 *
 * Usuarios, historial_puntajes y confirmado siguen en el Sheets de ENCIB (SPREADSHEET_ID).
 *
 * Compatibilidad: sin parámetro "exam" todo funciona como antes (ENCIB).
 *
 * DESPLIEGUE: pegar este archivo en el proyecto de Apps Script, Guardar e
 *   Implementar > Gestionar implementaciones > editar (lápiz) > Versión: Nueva versión > Implementar.
 *   Así se mantiene la misma URL /exec.
 *   ¡OJO! Las acciones del "Arma tu banqueo" (banqueoCatalog, banqueoIds, banqueoPorIds) solo
 *   existen tras REDESPLEGAR como "Nueva versión" en la MISMA implementación. Mientras no se haga,
 *   el frontend detecta el backend viejo y sigue con el banqueo clásico de 10 al azar.
 *   Antes de redesplegar se puede probar en el editor: testBanqueoCatalog() y testBanqueoIds().
 *   Si se editan las hojas Banco_*, ejecutar clearBanqueoCache() (o esperar 30 min).
 *
 * ID DE PREGUNTA: estable, sin tocar las hojas. Es un hash de 10 caracteres base36 (dos FNV-1a de
 *   32 bits) de questionText + option1 normalizados (sin HTML, sin tildes, minúsculas, espacios
 *   colapsados). Si se reordena la hoja o se agregan filas, el id no cambia; si se edita el texto
 *   de la pregunta o la opción 1, cambia (es otra pregunta para el progreso del alumno).
 *
 * BANQUEO v2 (contrato):
 *   ?action=banqueoCatalog&exam=X
 *     → { exam, courses:[{ name, total, temas:[{tema,total,subtemas:[{subtema,total}]}], fuentes:[{fuente,total}] }] }
 *   ?action=banqueoIds&exam=X&course=Y[&temas=a|b][&subtemas=c|d][&fuentes=e|f]
 *     → { exam, course, total, items:[{id,tema,subtema,fuente}] }   (filtros separados por "|", AND entre grupos)
 *   ?action=banqueoPorIds&exam=X&course=Y&ids=id1,id2,...   (máx. 30)
 *     → { exam, course, totalQuestions, questions:[Question...], missing:[ids no encontrados] }  (en el orden pedido)
 *
 * SEGURIDAD (v4): todo contenido exige un token de sesión en el parámetro "t" (se sigue usando GET por CORS).
 *   CUENTA SINAPSIS (banqueo + simulacros pagados): el alumno entra con su cuenta de sinapsisedu.com.
 *     El portal le da un ticket de un solo uso (5 min) y lo manda a /acceso?ticket=...; el frontend llama
 *     ?action=loginTicket&ticket=T → este backend lo canjea con el de SINAPSIS (verificarTicketBanqueo,
 *     servidor a servidor) → { token, exams:[...], nombre, correo, dni, fin:{exam:'YYYY-MM-DD'}, tokenExpiresIn }.
 *     Token "cuenta" (6 h, se renueva con cada uso): vale como "sim" y como "banqueo", solo para sus exams.
 *     Identidad para cuotas/historial: d = 'U:' + id_usuario (dni/correo/nombre van para la marca de agua).
 *   checkAccess → SOLO el primer simulacro gratis por DNI y examen (la hoja "confirmado" ya no da nada).
 *   checkBanqueoAccess → siempre canAccess:false ("Entra con tu cuenta de sinapsisedu.com").
 *   Token "sim" (gratis): questions (1 vez), gradeSimulacro (SIN correctAnswer ni justification), register.
 *   Token "cuenta": questions, gradeSimulacro, getHistory, getBanqueoQuestions, banqueoIds, banqueoPorIds.
 *   Públicas: exams, config, banqueoCatalog, test.
 *   El DNI SIEMPRE sale del token (los parámetros dni/email se ignoran salvo en checkAccess*).
 *   ?action=questions&exam=X&t=TOKEN
 *     → { exam, attemptId, expiresInSeconds, questions:[Question SIN correctAnswer ni justification] }
 *   ?action=gradeSimulacro&exam=X&t=TOKEN&attemptId=A&answers=0-21...   (1 carácter por pregunta, '-' = en blanco)
 *     → { exam, attemptId, correctAnswers, totalQuestions, rawScore, maxPoints, vigesimalScore, scaleMax, passing,
 *         saved, free, courses:[{name, correct, total}],
 *         results:[{id, selected, correctAnswer, justification}] }   (pagado)
 *         results:[{id, selected, correct}]                            (gratis: sin clave de respuestas)
 *     (idempotente; guarda el puntaje una vez)
 *   Errores: { success:false, error:"mensaje en español", code } con code ∈ AUTH_REQUIRED, AUTH_EXPIRED,
 *     FORBIDDEN, TOKEN_USED, QUOTA, ATTEMPT_NOT_FOUND, BUSY, BAD_REQUEST, BAD_ACTION, TICKET_INVALID, ERROR.
 *   Cuotas y vencimientos: constantes LIMITS / *_TTL_SECONDS más abajo. Para desbloquear a un alumno:
 *     resetQuotasForDni('DNI') desde el editor. Prueba: testSecurityFlow().
 *   Contadores diarios en Propiedades del script (claves "d:AAAAMMDD:..."; se purgan solos cada día).
 */

// ============================================
// CONFIGURACIÓN
// ============================================
const SPREADSHEET_ID = '1S0HFMTZQ5wk4u5idfEH-NGKkmzG0Rp1OnBJMd7IFwWI'; // ENCIB + usuarios

const EXAMS = {
  encib: {
    id: 'encib', nombre: 'ENCIB', descripcion: 'Examen Nacional de Ciencias Básicas (ASPEFAM)',
    spreadsheetId: SPREADSHEET_ID, configSheet: null, // legado: usa COURSE_CONFIG
    durationMinutes: 120, alternatives: 4, scaleMax: 20, passing: null,
    fuente: 'Bases ENCIB 2026 y Tabla de especificaciones ENCIB 2025 (ASPEFAM)'
  },
  enam: {
    id: 'enam', nombre: 'ENAM', descripcion: 'Examen Nacional de Medicina (ASPEFAM)',
    spreadsheetId: '1h51BGuazSH-FTAu75381JTrzagfVXmJ1xyUZM0h5qIk', configSheet: 'Configuración_ENAM',
    durationMinutes: 180, alternatives: 4, scaleMax: 20, passing: 11,
    fuente: 'Tabla de especificaciones ENAM 2026 (ASPEFAM)'
  },
  rm: {
    id: 'rm', nombre: 'Residentado Médico', descripcion: 'Examen de admisión al Residentado (CONAREME) – especialidades',
    spreadsheetId: '173AvP2ugSDW0mxjUhXtCKLXa0nm-CBHccGFkpt7ZS8Y', configSheet: 'Configuración_RM',
    durationMinutes: 240, alternatives: 4, scaleMax: 80, passing: null,
    fuente: 'Procedimiento CONAREME 2025 / Disposiciones 2026; reparto según exámenes reales'
  },
  serums: {
    id: 'serums', nombre: 'SERUMS (ENCAPS)', descripcion: 'Evaluación para el SERUMS – MINSA',
    spreadsheetId: '1uW6bFmIVF3Tkre08kPaJfEa4e6btAyhDV0Ulzf81ssI', configSheet: 'Configuración_SERUMS',
    durationMinutes: 120, alternatives: 4, scaleMax: 20, passing: null,
    fuente: 'Temario SERUMS 2026-II; reparto según examen oficial 2026-I'
  },
  essalud: {
    id: 'essalud', nombre: 'Internado EsSalud', descripcion: 'Examen de ingreso al Internado Médico EsSalud',
    spreadsheetId: '1elog_m5TzeVyLkV3muUJM75LTA8diAaiQ-_QuzB8am8', configSheet: 'Configuración_ESSALUD',
    durationMinutes: 180, alternatives: 5, scaleMax: 20, passing: 13,
    fuente: 'Bases Internado EsSalud; reparto según 21 exámenes EsSalud 2001-2023'
  }
};
const EXAM_ORDER = ['encib', 'enam', 'rm', 'serums', 'essalud'];

// ENCIB (legado: su hoja de configuración no tiene la columna HOJAS BANCO)
const COURSE_CONFIG = {
  'Anatomía': { code: 1, questionCount: 16, sheetName: 'Banco_Anatomía' },
  'Embriología': { code: 2, questionCount: 7, sheetName: 'Banco_Embriología' },
  'Histología': { code: 3, questionCount: 9, sheetName: 'Banco_Histología' },
  'Bioquímica': { code: 4, questionCount: 9, sheetName: 'Banco_Bioquímica' },
  'Fisiología': { code: 5, questionCount: 16, sheetName: 'Banco_Fisiología' },
  'Patología': { code: 6, questionCount: 16, sheetName: 'Banco_Patología' },
  'Farmacología': { code: 7, questionCount: 16, sheetName: 'Banco_Farmacología' },
  'Microbiología-Parasitología': { code: 8, questionCount: 11, sheetName: 'Banco_Microbiología' }
};
const COURSE_ORDER = [
  'Anatomía', 'Embriología', 'Histología', 'Bioquímica',
  'Fisiología', 'Patología', 'Farmacología', 'Microbiología-Parasitología'
];

const CONFIG_CACHE_SECONDS = 600;

// Backend de sinapsisedu.com (Apps Script): canjea los tickets del portal (verificarTicketBanqueo).
const SINAPSIS_API_URL = 'https://script.google.com/macros/s/AKfycby6vGh6slmvosiyi0ZDtjIACS64a21Ql8kC4C7HH1h1OZ_LctRFat-K0ud3AgdiF43PIA/exec';
const SINAPSIS_LOGIN_URL = 'https://sinapsisedu.com/#/login?next=banqueo';
const RE_TICKET = /^[A-Za-z0-9]{48}$/;

// ============================================
// SEGURIDAD — tokens y cuotas (ajustar aquí)
// ============================================
const TOKEN_TTL_SECONDS = 3 * 60 * 60;      // token del banqueo (legado): 3 h, se renueva con cada uso
const SIM_TOKEN_TTL_SECONDS = 6 * 60 * 60;  // token del simulacro: 6 h (el RM dura 4 h; 6 h es el máximo de CacheService)
const CUENTA_TOKEN_TTL_SECONDS = 6 * 60 * 60; // token de la cuenta SINAPSIS (banqueo + simulacros): 6 h, se renueva con cada uso
const ATTEMPT_TTL_SECONDS = 6 * 60 * 60;    // clave de respuestas de un intento de simulacro
const QUOTA_TZ = 'America/Lima';            // "día" y "hora" de las cuotas
const LIMITS = {
  ACCESOS_HORA: 40,              // checkAccess + checkBanqueoAccess por DNI y hora (el formulario verifica mientras se escribe)
  SIM_GRATIS_DIA: 2,             // simulacros gratis generados por DNI, examen y día (1 + 1 reintento si falla la red)
  SIM_GRATIS_GLOBAL_HORA: 300,   // simulacros gratis de TODO el sitio por hora (frena la creación masiva de DNI falsos)
  SIM_HORA: 3,                   // simulacros pagados (action=questions) por cuenta y hora
  SIM_DIA: 8,                    // ... y por día
  BANQUEO_IDS_HORA: 60,          // llamadas a banqueoIds por DNI y hora
  BANQUEO_PREGUNTAS_HORA: 400,   // preguntas NUEVAS del banqueo (banqueoPorIds + getBanqueoQuestions) por DNI y hora
  BANQUEO_PREGUNTAS_DIA: 1500,   // ... y por día
  HISTORIAL_HORA: 60,            // getHistory por DNI y hora
  LOGIN_TICKET_HORA: 600         // canjes de ticket (loginTicket) de TODO el sitio por hora
};

// ============================================
// ENDPOINT REST
// ============================================
function doGet(e) {
  try {
    const p = e.parameter || {};
    const action = p.action;
    const examId = resolveExamId(p.exam);
    let result;
    let info;

    switch (action) {
      // ----- Públicas (sin datos sensibles) -----
      case 'exams':
        result = listExams();
        break;
      case 'config':
        result = getConfig(examId);
        break;
      case 'banqueoCatalog':
        result = getBanqueoCatalog(examId);
        break;
      case 'test':
        result = { status: 'ok', message: 'API SINAPSIS multi-examen funcionando', exams: EXAM_ORDER, secure: true, timestamp: new Date().toISOString() };
        break;

      // ----- Acceso: emiten el token de sesión -----
      case 'checkAccess':
        if (!p.dni) throw apiError_('BAD_REQUEST', 'Parámetro "dni" requerido');
        result = checkUserAccess(cleanDni_(p.dni), p.email || '', examId);
        break;
      case 'checkBanqueoAccess':
        // Obsoleto: el banqueo se abre con la cuenta de sinapsisedu.com (loginTicket).
        result = checkBanqueoAccess();
        break;
      case 'loginTicket':
        result = loginTicket_(p.ticket);
        break;

      // ----- Simulacro (token scope "sim") -----
      case 'questions':
        result = getSimulacro_(p.t, examId);
        break;
      case 'gradeSimulacro':
        result = gradeSimulacro_(p.t, p.attemptId, p.answers, examId);
        break;
      case 'register':
        info = requireToken_(p.t, ['sim', 'banqueo'], null);
        // La cuenta SINAPSIS ya tiene sus datos en sinapsisedu.com: no se registra en "usuarios"
        // (su identidad 'U:…' ensuciaría la detección de DNI/correo duplicados del simulacro gratis).
        result = info.s === 'cuenta'
          ? { registered: true, message: 'Cuenta SINAPSIS', existing: true }
          : registerUser(info.d, p.fullName || '', info.e, p.phone || '', p.university || '');
        break;
      case 'saveScore':
        // Obsoleto: gradeSimulacro ya guarda el puntaje. Se mantiene por compatibilidad, con el DNI del token.
        info = requireToken_(p.t, ['cuenta'], examId);
        result = saveUserScore(
          info.d,
          parseInt(p.correctAnswers) || 0,
          parseInt(p.totalQuestions) || 100,
          parseFloat(p.rawScore) || 0,
          parseFloat(p.vigesimalScore) || 0,
          examId
        );
        break;
      case 'getHistory':
        info = requireToken_(p.t, ['sim', 'banqueo'], null);
        withLock_(function () { consumeQuota_('hist', info.d, 1, LIMITS.HISTORIAL_HORA, 0, 'consultas de historial'); });
        result = getUserHistory(info.d, examId);
        break;

      // ----- Banqueo (token scope "banqueo") -----
      case 'getBanqueoQuestions':
        if (!p.course) throw apiError_('BAD_REQUEST', 'Parámetro "course" requerido');
        info = requireToken_(p.t, ['banqueo'], examId);
        result = getBanqueoQuestions(p.course, examId, info.d);
        break;
      case 'banqueoIds':
        if (!p.course) throw apiError_('BAD_REQUEST', 'Parámetro "course" requerido');
        info = requireToken_(p.t, ['banqueo'], examId);
        withLock_(function () { consumeQuota_('bids', info.d, 1, LIMITS.BANQUEO_IDS_HORA, 0, 'consultas de la lista de preguntas'); });
        result = getBanqueoIds(examId, p.course, {
          temas: splitList_(p.temas, '|'),
          subtemas: splitList_(p.subtemas, '|'),
          fuentes: splitList_(p.fuentes, '|')
        });
        break;
      case 'banqueoPorIds': {
        if (!p.course) throw apiError_('BAD_REQUEST', 'Parámetro "course" requerido');
        if (!p.ids) throw apiError_('BAD_REQUEST', 'Parámetro "ids" requerido');
        info = requireToken_(p.t, ['banqueo'], examId);
        const ids = splitList_(p.ids, ',');
        if (ids.length > BANQUEO_MAX_POR_IDS) throw apiError_('BAD_REQUEST', 'Máximo ' + BANQUEO_MAX_POR_IDS + ' ids por llamada');
        consumeBanqueo_(info.d, ids);
        result = getBanqueoPorIds(examId, p.course, ids);
        break;
      }
      default:
        return createErrorResponse('Acción no válida. Use: exams, config, questions, gradeSimulacro, register, saveScore, getHistory, checkAccess, checkBanqueoAccess, loginTicket, getBanqueoQuestions, banqueoCatalog, banqueoIds, banqueoPorIds o test', 'BAD_ACTION');
    }
    return createSuccessResponse(result);
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    return createErrorResponse(msg, (error && error.code) || 'ERROR');
  }
}

function resolveExamId(raw) {
  const id = String(raw || 'encib').toLowerCase().trim();
  if (!EXAMS[id]) throw new Error('Examen no válido: ' + id + '. Use: ' + EXAM_ORDER.join(', '));
  return id;
}

function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message, code) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: message, code: code || 'ERROR' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// SEGURIDAD: tokens de sesión, cuotas y calificación en el servidor
// ============================================

/** Error con código para el cliente (AUTH_REQUIRED, AUTH_EXPIRED, FORBIDDEN, TOKEN_USED, QUOTA, ...). */
function apiError_(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function cleanDni_(raw) {
  const d = String(raw || '').trim();
  if (!d || d.length > 20 || !/^[0-9A-Za-z-]+$/.test(d)) throw apiError_('BAD_REQUEST', 'DNI no válido');
  return d;
}

/** 64 caracteres hex aleatorios (dos UUID v4 de Utilities.getUuid, generador seguro). */
function newSecret_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}

function tokenTtl_(info) {
  if (info.s === 'cuenta') return CUENTA_TOKEN_TTL_SECONDS;
  return info.s === 'sim' ? SIM_TOKEN_TTL_SECONDS : TOKEN_TTL_SECONDS;
}

/**
 * info = { d: identidad (DNI, o 'U:'+id_usuario en la cuenta), e: email, s: 'sim'|'banqueo'|'cuenta',
 *          x: examId | '*' | [examIds] (cuenta), f: primer intento gratis, n: llamadas a questions restantes (solo gratis),
 *          dni / nm: DNI y nombre para la marca de agua (solo cuenta) }
 */
function issueToken_(info) {
  const t = newSecret_();
  saveToken_(t, info);
  return t;
}

function saveToken_(t, info) {
  const ttl = tokenTtl_(info);
  info.exp = Date.now() + ttl * 1000;
  CacheService.getScriptCache().put('tok:' + t, JSON.stringify(info), ttl);
}

function readToken_(t) {
  if (!t || !/^[a-f0-9]{64}$/.test(String(t))) return null;
  const raw = CacheService.getScriptCache().get('tok:' + t);
  if (!raw) return null;
  const info = JSON.parse(raw);
  return info && info.exp > Date.now() ? info : null;
}

/** ¿El token permite este examen? x = '*' | examId | [examIds]. */
function tokenAllowsExam_(info, examId) {
  if (!examId || info.x === '*') return true;
  if (Array.isArray(info.x)) return info.x.indexOf(examId) !== -1;
  return info.x === examId;
}

/**
 * Valida el token (parámetro "t") y refresca su vencimiento. examId null = cualquier examen.
 * El token "cuenta" (cuenta SINAPSIS) vale donde se acepte "sim" o "banqueo".
 */
function requireToken_(t, scopes, examId) {
  if (!t) throw apiError_('AUTH_REQUIRED', 'Sesión requerida: vuelve a entrar con tu cuenta de sinapsisedu.com.');
  const info = readToken_(t);
  if (!info) throw apiError_('AUTH_EXPIRED', 'Tu sesión expiró: vuelve a entrar con tu cuenta de sinapsisedu.com.');
  // Tokens "banqueo" del acceso viejo por DNI + correo: ya no valen (el banqueo es solo con la cuenta).
  if (info.s === 'banqueo') throw apiError_('AUTH_EXPIRED', 'Ahora el banqueo se abre con tu cuenta de sinapsisedu.com.');
  const scopeOk = scopes.indexOf(info.s) !== -1 ||
    (info.s === 'cuenta' && (scopes.indexOf('sim') !== -1 || scopes.indexOf('banqueo') !== -1));
  if (!scopeOk) throw apiError_('FORBIDDEN', 'Tu sesión no da acceso a esta sección.');
  if (!tokenAllowsExam_(info, examId)) {
    throw apiError_('FORBIDDEN', info.s === 'cuenta'
      ? 'Tu cuenta no tiene un acceso activo a este examen.'
      : 'Tu sesión es de otro examen: vuelve a ingresar tus datos.');
  }
  saveToken_(t, info);
  return info;
}

// ----- Cuenta SINAPSIS: canje del ticket de un solo uso -----

/** Pregunta al backend de sinapsisedu.com por el ticket (y lo consume). Devuelve el envelope {ok,data,error}. */
function verificarTicketSinapsis_(ticket) {
  const resp = UrlFetchApp.fetch(SINAPSIS_API_URL, {
    method: 'post',
    contentType: 'text/plain',
    payload: JSON.stringify({ action: 'verificarTicketBanqueo', ticket: ticket }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  try {
    return JSON.parse(resp.getContentText());
  } catch (e) {
    throw apiError_('ERROR', 'No se pudo verificar tu acceso con sinapsisedu.com. Intenta de nuevo.');
  }
}

/**
 * Canjea el ticket del portal por un token "cuenta" (banqueo + simulacros pagados de sus exámenes).
 * verify (opcional, para pruebas) reemplaza la llamada HTTP a sinapsisedu.com.
 */
function loginTicket_(ticket, verify) {
  ticket = String(ticket || '');
  if (!RE_TICKET.test(ticket)) throw apiError_('TICKET_INVALID', 'Enlace de acceso inválido o vencido. Vuelve a entrar desde tu portal.');
  withLock_(function () { consumeQuota_('lticket', 'all', 1, LIMITS.LOGIN_TICKET_HORA, 0, 'accesos al banqueo del sitio'); });
  const env = (verify || verificarTicketSinapsis_)(ticket);
  if (!env || env.ok !== true || !env.data) {
    throw apiError_('TICKET_INVALID', 'Enlace de acceso inválido o vencido (dura 5 minutos y sirve una sola vez). Vuelve a entrar desde tu portal.');
  }
  const u = env.data;
  const idUsuario = String(u.id_usuario || '').trim();
  const exams = (Array.isArray(u.exams) ? u.exams : [])
    .map(function (x) { return String(x).toLowerCase(); })
    .filter(function (x, i, arr) { return EXAMS.hasOwnProperty(x) && arr.indexOf(x) === i; });
  if (!idUsuario || !exams.length) throw apiError_('FORBIDDEN', 'Tu cuenta no tiene un acceso activo al banqueo.');

  const fin = {};
  exams.forEach(function (x) { fin[x] = u.fin && u.fin[x] ? String(u.fin[x]) : ''; });
  const correo = String(u.correo || '').toLowerCase().trim();
  const nombre = String(u.nombre || '').trim();
  const dni = String(u.dni || '').trim();
  const token = issueToken_({ d: 'U:' + idUsuario, e: correo, dni: dni, nm: nombre, s: 'cuenta', x: exams });
  return {
    token: token, tokenExpiresIn: CUENTA_TOKEN_TTL_SECONDS,
    exams: exams, nombre: nombre, correo: correo, dni: dni, fin: fin
  };
}

function hourBucket_() { return Utilities.formatDate(new Date(), QUOTA_TZ, 'yyyyMMddHH'); }
function dayBucket_() { return Utilities.formatDate(new Date(), QUOTA_TZ, 'yyyyMMdd'); }
function minutesToNextHour_() { return 60 - parseInt(Utilities.formatDate(new Date(), QUOTA_TZ, 'm'), 10); }

/** Ejecuta fn con el candado del script (las cuotas y los tokens de un solo uso no admiten carreras). */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw apiError_('BUSY', 'El servidor está ocupado. Intenta de nuevo en unos segundos.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Borra los contadores diarios de días anteriores (una vez al día). */
function purgeOldDaily_(props) {
  const today = dayBucket_();
  if (props.getProperty('d_day') === today) return;
  props.getKeys().forEach(function (k) {
    if (k.indexOf('d:') === 0 && k.indexOf('d:' + today + ':') !== 0) props.deleteProperty(k);
  });
  props.setProperty('d_day', today);
}

/**
 * Suma "amount" a los contadores de "name" para "subject" (DNI): por hora en CacheService y por día en
 * PropertiesService (CacheService dura máx. 6 h). perHour/perDay = 0 → sin ese límite.
 * Lanza QUOTA (sin consumir nada) si se pasa. Llamar dentro de withLock_.
 */
function consumeQuota_(name, subject, amount, perHour, perDay, label) {
  const cache = CacheService.getScriptCache();
  const hk = 'h:' + name + ':' + subject + ':' + hourBucket_();
  const usedH = parseInt(cache.get(hk), 10) || 0;
  let props = null, dk = null, usedD = 0;
  if (perDay) {
    props = PropertiesService.getScriptProperties();
    purgeOldDaily_(props);
    dk = 'd:' + dayBucket_() + ':' + name + ':' + subject;
    usedD = parseInt(props.getProperty(dk), 10) || 0;
  }
  if (perHour && usedH + amount > perHour) {
    throw apiError_('QUOTA', 'Llegaste al límite de ' + label + ' por hora (' + perHour + '). Vuelve a intentarlo en ' +
      minutesToNextHour_() + ' min.');
  }
  if (perDay && usedD + amount > perDay) {
    throw apiError_('QUOTA', 'Llegaste al límite diario de ' + label + ' (' + perDay + '). Vuelve mañana.');
  }
  if (amount <= 0) return;
  cache.put(hk, String(usedH + amount), 3700);
  if (dk) props.setProperty(dk, String(usedD + amount));
}

/** Banqueo: solo cuentan las preguntas NUEVAS del día (volver a pedir una ya vista no gasta cuota). */
function consumeBanqueo_(dni, ids) {
  withLock_(function () {
    const cache = CacheService.getScriptCache();
    const key = 'seen:' + dni + ':' + dayBucket_();
    const raw = cache.get(key) || '';
    const seen = {};
    raw.split(',').forEach(function (id) { if (id) seen[id] = true; });
    const fresh = [];
    ids.forEach(function (id) { if (!seen[id]) { seen[id] = true; fresh.push(id); } });
    consumeQuota_('bq', dni, fresh.length, LIMITS.BANQUEO_PREGUNTAS_HORA, LIMITS.BANQUEO_PREGUNTAS_DIA, 'preguntas del banqueo');
    if (fresh.length) {
      const next = raw ? raw + ',' + fresh.join(',') : fresh.join(',');
      if (next.length < 95000) cache.put(key, next, 21600);
    }
  });
}

// ----- Simulacro: preguntas sin respuestas + intento guardado en el servidor -----

function stripAnswers_(q) {
  const out = {};
  Object.keys(q).forEach(function (k) { if (k !== 'correctAnswer' && k !== 'justification') out[k] = q[k]; });
  return out;
}

function getSimulacro_(t, examId) {
  const info = requireToken_(t, ['sim'], examId);
  // Simulacros pagados: solo con la cuenta SINAPSIS. Un token "sim" solo sirve para el intento gratis.
  if (info.s !== 'cuenta' && !info.f) {
    throw apiError_('FORBIDDEN', 'Para más simulacros, entra con tu cuenta de sinapsisedu.com.');
  }
  withLock_(function () {
    if (info.s !== 'cuenta') {
      const cur = readToken_(t);
      if (!cur || !(cur.n > 0)) {
        throw apiError_('TOKEN_USED', 'Esta sesión ya generó tu simulacro gratuito. Vuelve a ingresar tus datos para reintentar.');
      }
      consumeQuota_('simfree', examId + ':' + info.d, 1, 0, LIMITS.SIM_GRATIS_DIA, 'simulacros gratuitos generados');
      consumeQuota_('simfree_all', 'all', 1, LIMITS.SIM_GRATIS_GLOBAL_HORA, 0, 'simulacros gratuitos del sitio');
      cur.n = 0;
      saveToken_(t, cur);
    } else {
      consumeQuota_('sim', info.d, 1, LIMITS.SIM_HORA, LIMITS.SIM_DIA, 'simulacros');
    }
  });

  const full = getQuestions(examId);
  const attemptId = newSecret_();
  const att = {
    d: info.d, x: examId, f: info.s !== 'cuenta', c: Date.now(),
    q: full.map(function (q) { return [q.id, q.correctAnswer, q.points, q.subject || '']; })
  };
  const cache = CacheService.getScriptCache();
  cache.put('attk:' + attemptId, JSON.stringify(att), ATTEMPT_TTL_SECONDS);
  // El intento gratis nunca devuelve justificaciones: no se guardan.
  if (!att.f) {
    const justifs = full.map(function (q) { return q.justification || null; });
    cachePutChunked_(cache, 'attj:' + attemptId, JSON.stringify(justifs), ATTEMPT_TTL_SECONDS);
  }
  return {
    exam: examId,
    attemptId: attemptId,
    expiresInSeconds: ATTEMPT_TTL_SECONDS,
    questions: full.map(stripAnswers_)
  };
}

/** Justificaciones por id base (si la caché del intento se perdió, se releen las hojas). */
function reloadJustifications_(examId, ids) {
  const ss = SpreadsheetApp.openById(EXAMS[examId].spreadsheetId);
  const wanted = {};
  ids.forEach(function (id) { wanted[String(id).replace(/-\d+$/, '')] = null; });
  const sheets = [];
  getExamCourses(examId).forEach(function (c) { c.sheets.forEach(function (s) { if (sheets.indexOf(s) === -1) sheets.push(s); }); });
  readBankRows(ss, sheets).forEach(function (q) {
    const id = rowId_(q);
    if (wanted.hasOwnProperty(id) && wanted[id] === null) wanted[id] = safeCell(q.data, q.cols.justification) || '';
  });
  return ids.map(function (id) { return wanted[String(id).replace(/-\d+$/, '')] || null; });
}

/**
 * Calificación pura (sin hojas ni caché). att = intento guardado; justifs = array (pagado) o null (gratis).
 * Intento GRATIS (att.f): nota, desglose por curso y acierto por pregunta, SIN correctAnswer ni justification.
 */
function buildGradeResult_(att, answers, examId, attemptId, justifs) {
  const ans = String(answers || '');
  const exam = EXAMS[examId];
  const free = !!att.f;
  let correct = 0, raw2 = 0, max = 0;
  const courses = [];
  const courseIdx = {};
  const graded = att.q.map(function (row, i) {
    const ch = ans.charAt(i);
    const sel = /^[0-9]$/.test(ch) ? parseInt(ch, 10) : null;
    const pts = Number(row[2]) > 0 ? Number(row[2]) : 1;
    const ok = sel !== null && sel === row[1];
    max += pts;
    if (ok) { correct++; raw2 += pts; }
    const name = String(row[3] || '');
    if (!courseIdx.hasOwnProperty(name)) { courseIdx[name] = courses.length; courses.push({ name: name, correct: 0, total: 0 }); }
    const c = courses[courseIdx[name]];
    c.total++;
    if (ok) c.correct++;
    return { sel: sel, ok: ok };
  });
  const round2 = function (v) { return Math.round(v * 100) / 100; };
  const scaleMax = exam.scaleMax > 0 ? exam.scaleMax : 20;
  return {
    exam: examId,
    attemptId: attemptId,
    correctAnswers: correct,
    totalQuestions: att.q.length,
    rawScore: round2(raw2),
    maxPoints: round2(max),
    vigesimalScore: max > 0 ? round2((raw2 / max) * scaleMax) : 0,
    scaleMax: scaleMax,
    passing: exam.passing,
    saved: true,
    free: free,
    courses: courses,
    results: att.q.map(function (row, i) {
      if (free) return { id: row[0], selected: graded[i].sel, correct: graded[i].ok };
      return { id: row[0], selected: graded[i].sel, correctAnswer: row[1], justification: (justifs && justifs[i]) || null };
    })
  };
}

/**
 * Califica en el servidor. answers = un carácter por pregunta, en el orden servido:
 * '0'..'9' = índice elegido, '-' (u otro) = en blanco. Guarda el puntaje con el DNI del intento.
 * Idempotente: si se reintenta, devuelve la misma calificación sin volver a guardar.
 */
function gradeSimulacro_(t, attemptId, answers, examId) {
  const info = requireToken_(t, ['sim'], examId);
  attemptId = String(attemptId || '');
  if (!/^[a-f0-9]{64}$/.test(attemptId)) throw apiError_('BAD_REQUEST', 'Parámetro "attemptId" no válido');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('attk:' + attemptId);
  if (!raw) throw apiError_('ATTEMPT_NOT_FOUND', 'Este intento expiró (más de 6 horas) o no existe. Inicia un simulacro nuevo.');
  const att = JSON.parse(raw);
  if (att.d !== info.d || att.x !== examId) throw apiError_('FORBIDDEN', 'Este intento pertenece a otra sesión.');

  const done = withLock_(function () {
    const prev = cacheGetChunked_(cache, 'attr:' + attemptId);
    if (prev) return prev;
    if (cache.get('attg:' + attemptId)) throw apiError_('BUSY', 'Tu examen se está calificando. Intenta de nuevo en unos segundos.');
    cache.put('attg:' + attemptId, '1', 120);
    return null;
  });
  if (done) return JSON.parse(done);

  try {
    let justifs = null;
    if (!att.f) {
      const jRaw = cacheGetChunked_(cache, 'attj:' + attemptId);
      if (jRaw) justifs = JSON.parse(jRaw);
      else justifs = reloadJustifications_(examId, att.q.map(function (r) { return r[0]; }));
    }
    const result = buildGradeResult_(att, answers, examId, attemptId, justifs);
    saveUserScore(att.d, result.correctAnswers, result.totalQuestions, result.rawScore, result.vigesimalScore, examId);
    cachePutChunked_(cache, 'attr:' + attemptId, JSON.stringify(result), ATTEMPT_TTL_SECONDS);
    return result;
  } finally {
    cache.remove('attg:' + attemptId);
  }
}

// ============================================
// HELPERS DE LECTURA
// ============================================
function normalizeHeader(s) {
  if (s === null || s === undefined) return '';
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function findColumnIndex(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(normalizeHeader(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

function safeCell(row, idx) {
  if (idx === -1 || idx === undefined) return null;
  const v = row[idx];
  if (v === undefined || v === null || v === '') return null;
  return v;
}

function bankColumns(headers) {
  return {
    questionText: findColumnIndex(headers, ['Question Text', 'Pregunta', 'Texto']),
    questionType: findColumnIndex(headers, ['Question Type', 'Tipo', 'Tipo de pregunta']),
    option1: findColumnIndex(headers, ['Option 1', 'Opción 1', 'Opcion 1']),
    option2: findColumnIndex(headers, ['Option 2', 'Opción 2', 'Opcion 2']),
    option3: findColumnIndex(headers, ['Option 3', 'Opción 3', 'Opcion 3']),
    option4: findColumnIndex(headers, ['Option 4', 'Opción 4', 'Opcion 4']),
    option5: findColumnIndex(headers, ['Option 5', 'Opción 5', 'Opcion 5']),
    correctAnswer: findColumnIndex(headers, ['Correct Answer', 'Respuesta correcta', 'Correcta']),
    timeSeconds: findColumnIndex(headers, ['Time in seconds', 'Tiempo', 'Tiempo en segundos']),
    imageLink: findColumnIndex(headers, ['Image Link', 'Imagen', 'Image', 'Link imagen']),
    numero: findColumnIndex(headers, ['NUMERO', 'Número', 'Numero', 'N°']),
    curso: findColumnIndex(headers, ['CURSO', 'Curso']),
    tema: findColumnIndex(headers, ['TEMA', 'Tema']),
    subtema: findColumnIndex(headers, ['SUBTEMA', 'Subtema', 'Sub tema']),
    sourceFile: findColumnIndex(headers, ['NOMBRE DEL ARCHIVO', 'Archivo', 'Fuente', 'Source']),
    justification: findColumnIndex(headers, [
      'JUSTIFICACION', 'JUSTIFICACIÓN', 'Justificacion', 'Justificación',
      'JUSTIFICACIONES', 'Justificaciones', 'Explicacion', 'Explicación', 'EXPLICACION', 'EXPLICACIÓN'
    ])
  };
}

/** Lee todas las filas válidas de varias hojas Banco_* de un Sheets. */
function readBankRows(ss, sheetNames) {
  const rows = [];
  sheetNames.forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { console.log('Advertencia: hoja "' + name + '" no encontrada'); return; }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    const cols = bankColumns(data[0]);
    for (let i = 1; i < data.length; i++) {
      if (!safeCell(data[i], cols.questionText)) continue;
      rows.push({ sheet: name, rowIndex: i, data: data[i], cols: cols });
    }
  });
  return rows;
}

// ============================================
// ID ESTABLE DE PREGUNTA (hash de questionText + option1)
// ============================================
function normalizeForId_(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fnv1a32_(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Id de 10 caracteres base36 (~51 bits): dos FNV-1a con semillas distintas. */
function questionId_(questionText, option1) {
  const s = normalizeForId_(questionText) + '\u0001' + normalizeForId_(option1);
  const a = fnv1a32_(s, 0x811c9dc5).toString(36);
  const b = fnv1a32_(s, 0x9747b28c).toString(36);
  return ('0000000' + a).slice(-7) + ('0000000' + b).slice(-3);
}

function rowId_(q) {
  if (!q._id) q._id = questionId_(safeCell(q.data, q.cols.questionText), safeCell(q.data, q.cols.option1));
  return q._id;
}

function formatQuestion(q, opts) {
  const row = q.data, c = q.cols;
  const options = [
    safeCell(row, c.option1), safeCell(row, c.option2), safeCell(row, c.option3),
    safeCell(row, c.option4), safeCell(row, c.option5)
  ].filter(function (o) { return o !== null; });
  const correctAnswerIndex = (parseInt(safeCell(row, c.correctAnswer)) || 1) - 1;
  return {
    id: opts.id || rowId_(q),
    number: opts.number,
    questionText: safeCell(row, c.questionText),
    questionType: safeCell(row, c.questionType) || 'Caso Clínico',
    options: options,
    correctAnswer: correctAnswerIndex,
    timeSeconds: parseInt(safeCell(row, c.timeSeconds)) || 90,
    imageLink: safeCell(row, c.imageLink),
    subject: opts.subject,
    points: opts.points,
    sourceFile: safeCell(row, c.sourceFile),
    justification: safeCell(row, c.justification),
    metadata: {
      numero: safeCell(row, c.numero),
      curso: safeCell(row, c.curso),
      tema: safeCell(row, c.tema),
      subtema: safeCell(row, c.subtema)
    }
  };
}

// ============================================
// CONFIGURACIÓN POR EXAMEN
// ============================================

/** Devuelve [{code, name, questionCount, points, sheets:[...]}] del examen. */
function getExamCourses(examId) {
  const exam = EXAMS[examId];
  if (!exam.configSheet) {
    return COURSE_ORDER.map(function (name) {
      const c = COURSE_CONFIG[name];
      return { code: c.code, name: name, questionCount: c.questionCount, points: 1, sheets: [c.sheetName] };
    });
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'cfg_' + examId;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.openById(exam.spreadsheetId);
  const sheet = ss.getSheetByName(exam.configSheet);
  if (!sheet) throw new Error('No existe la hoja ' + exam.configSheet + ' en el Sheets de ' + exam.nombre);
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const iCod = findColumnIndex(h, ['COD.', 'COD', 'Código']);
  const iCurso = findColumnIndex(h, ['CURSO', 'Área', 'Area']);
  const iN = findColumnIndex(h, ['N° PREGUNTAS', 'Nº PREGUNTAS', 'N PREGUNTAS', 'Preguntas']);
  const iPts = findColumnIndex(h, ['PUNTOS POR PREGUNTA', 'Puntos']);
  const iHojas = findColumnIndex(h, ['HOJAS BANCO', 'Hojas']);

  const courses = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const name = safeCell(r, iCurso);
    const n = parseInt(safeCell(r, iN));
    if (!name || String(safeCell(r, iCod)).toUpperCase() === 'TOTAL' || !(n >= 0)) continue;
    const hojasTxt = String(safeCell(r, iHojas) || ('Banco_' + name));
    courses.push({
      code: parseInt(safeCell(r, iCod)) || courses.length + 1,
      name: String(name).trim(),
      questionCount: n,
      points: parseFloat(String(safeCell(r, iPts) || 1).replace(',', '.')) || 1,
      // separa por coma solo cuando sigue una mayúscula ("Banco_..."), así "Endocrinología, metabolismo..." queda entero
      sheets: hojasTxt.split(/,\s*(?=Banco_)/).map(function (s) { return s.trim(); }).filter(String)
    });
  }
  cache.put(cacheKey, JSON.stringify(courses), CONFIG_CACHE_SECONDS);
  return courses;
}

function examMeta(examId) {
  const e = EXAMS[examId];
  return {
    id: e.id, nombre: e.nombre, descripcion: e.descripcion,
    durationMinutes: e.durationMinutes, alternatives: e.alternatives,
    scaleMax: e.scaleMax, passing: e.passing, fuente: e.fuente
  };
}

function listExams() {
  return EXAM_ORDER.map(function (id) {
    const meta = examMeta(id);
    try {
      const courses = getExamCourses(id);
      meta.totalQuestions = courses.reduce(function (s, c) { return s + c.questionCount; }, 0);
      meta.courseCount = courses.length;
      meta.available = true;
    } catch (err) {
      meta.available = false;
      meta.error = String(err);
    }
    return meta;
  });
}

function getConfig(examId) {
  const courses = getExamCourses(examId).map(function (c) {
    return { code: c.code, name: c.name, questionCount: c.questionCount, points: c.points };
  });
  const totalQuestions = courses.reduce(function (s, c) { return s + c.questionCount; }, 0);
  const maxPoints = courses.reduce(function (s, c) { return s + c.questionCount * c.points; }, 0);
  const meta = examMeta(examId);
  meta.totalQuestions = totalQuestions;
  meta.maxScore = Math.round(maxPoints * 100) / 100;
  meta.courses = courses;
  return meta;
}

// ============================================
// SIMULACRO
// ============================================
function getQuestions(examId) {
  const exam = EXAMS[examId];
  const ss = SpreadsheetApp.openById(exam.spreadsheetId);
  const questions = [];
  const usedIds = {};
  let number = 1;
  getExamCourses(examId).forEach(function (course) {
    if (course.questionCount <= 0) return;
    const pool = readBankRows(ss, course.sheets);
    selectRandomItems(pool, course.questionCount).forEach(function (q) {
      // El id es estable, pero si el banco tiene la misma pregunta duplicada se desambigua
      let id = rowId_(q);
      if (usedIds[id]) id = id + '-' + (++usedIds[id]); else usedIds[id] = 1;
      questions.push(formatQuestion(q, {
        id: id, number: number++, subject: course.name, points: course.points
      }));
    });
  });
  return questions; // ordenadas por curso, como el examen real
}

function shuffleArray(array) {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
  }
  return shuffled;
}

function selectRandomItems(array, count) {
  const shuffled = shuffleArray(array);
  return count >= shuffled.length ? shuffled : shuffled.slice(0, count);
}

// ============================================
// BANQUEO (práctica por curso, 10 preguntas)
// ============================================
function getBanqueoQuestions(courseName, examId, dni) {
  const exam = EXAMS[examId];
  const course = getExamCourses(examId).filter(function (c) { return c.name === courseName; })[0];
  if (!course) return { error: 'Curso no válido', questions: [] };

  const ss = SpreadsheetApp.openById(exam.spreadsheetId);
  const pool = readBankRows(ss, course.sheets);
  if (!pool.length) return { error: 'No hay preguntas disponibles', questions: [] };

  const picked = selectRandomItems(pool, 10);
  // La cuota se cobra antes de devolver nada (si se pasa, no sale ninguna pregunta)
  if (dni) consumeBanqueo_(dni, picked.map(rowId_));
  const usedIds = {};
  const questions = picked.map(function (q, i) {
    let id = rowId_(q);
    if (usedIds[id]) id = id + '-' + (++usedIds[id]); else usedIds[id] = 1;
    return formatQuestion(q, { id: id, number: i + 1, subject: courseName, points: course.points });
  });
  return { exam: examId, course: courseName, totalQuestions: questions.length, stock: pool.length, questions: questions };
}

// ============================================
// BANQUEO v2 — "Arma tu banqueo" (catálogo, ids filtrados, preguntas por id)
// ============================================
const BANQUEO_CACHE_SECONDS = 1800;
const BANQUEO_CHUNK = 90000; // CacheService admite 100 KB por clave
const BANQUEO_MAX_POR_IDS = 30;
const SIN_TEMA = 'Sin tema';
const SIN_SUBTEMA = 'Sin subtema';
const SIN_FUENTE = 'Sin fuente';

function splitList_(raw, sep) {
  if (raw === undefined || raw === null || raw === '') return [];
  return String(raw).split(sep).map(function (s) { return s.trim(); }).filter(String);
}

/** Texto para mostrar: trim + espacios colapsados. */
function cleanLabel_(v, fallback) {
  const s = v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();
  return s || fallback;
}

/** Clave de agrupación: sin tildes, minúsculas, espacios colapsados. */
function labelKey_(s) {
  return normalizeHeader(s);
}

function findBanqueoCourse_(examId, courseName) {
  return getExamCourses(examId).filter(function (c) { return c.name === courseName; })[0] || null;
}

function banqueoCacheKey_(examId, courseName) {
  return 'bidx_' + examId + '_' + fnv1a32_(courseName, 0x811c9dc5).toString(36);
}

function cachePutChunked_(cache, key, str, ttl) {
  const parts = {};
  // 90 000 caracteres por trozo: con tildes/HTML en UTF-8 un trozo puede pasar de 100 KB, así que
  // para textos largos (justificaciones) se usa un trozo más chico.
  const size = ttl ? 30000 : BANQUEO_CHUNK;
  const n = Math.ceil(str.length / size) || 1;
  for (let i = 0; i < n; i++) parts[key + '_' + i] = str.substr(i * size, size);
  parts[key + '_n'] = String(n);
  try { cache.putAll(parts, ttl || BANQUEO_CACHE_SECONDS); } catch (err) { console.log('Cache llena: ' + err); }
}

function cacheGetChunked_(cache, key) {
  const n = parseInt(cache.get(key + '_n'));
  if (!(n > 0)) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const got = cache.getAll(keys);
  let str = '';
  for (let i = 0; i < n; i++) {
    if (got[keys[i]] === undefined || got[keys[i]] === null) return null;
    str += got[keys[i]];
  }
  return str;
}

/**
 * Índice compacto de un curso: { t:[temas], s:[subtemas], f:[fuentes], r:[[id, ti, si, fi], ...] }
 * Sin duplicados (misma pregunta en dos hojas = un solo id). Se cachea troceado.
 */
function getCourseIndex_(examId, course, ss) {
  const cache = CacheService.getScriptCache();
  const key = banqueoCacheKey_(examId, course.name);
  const cached = cacheGetChunked_(cache, key);
  if (cached) return JSON.parse(cached);

  ss = ss || SpreadsheetApp.openById(EXAMS[examId].spreadsheetId);
  const rows = readBankRows(ss, course.sheets);
  const idx = { t: [], s: [], f: [], r: [] };
  const maps = { t: {}, s: {}, f: {} };
  function intern(kind, label) {
    const k = labelKey_(label);
    if (maps[kind][k] === undefined) { maps[kind][k] = idx[kind].length; idx[kind].push(label); }
    return maps[kind][k];
  }
  const seen = {};
  rows.forEach(function (q) {
    const id = rowId_(q);
    if (seen[id]) return;
    seen[id] = true;
    idx.r.push([
      id,
      intern('t', cleanLabel_(safeCell(q.data, q.cols.tema), SIN_TEMA)),
      intern('s', cleanLabel_(safeCell(q.data, q.cols.subtema), SIN_SUBTEMA)),
      intern('f', cleanLabel_(safeCell(q.data, q.cols.sourceFile), SIN_FUENTE))
    ]);
  });
  cachePutChunked_(cache, key, JSON.stringify(idx));
  return idx;
}

function summarizeCourseIndex_(name, idx) {
  const temas = idx.t.map(function (t) { return { tema: t, total: 0, subtemas: {} }; });
  const fuentes = idx.f.map(function (f) { return { fuente: f, total: 0 }; });
  idx.r.forEach(function (r) {
    const t = temas[r[1]];
    t.total++;
    t.subtemas[r[2]] = (t.subtemas[r[2]] || 0) + 1;
    fuentes[r[3]].total++;
  });
  return {
    name: name,
    total: idx.r.length,
    temas: temas.filter(function (t) { return t.total > 0; }).map(function (t) {
      return {
        tema: t.tema,
        total: t.total,
        subtemas: Object.keys(t.subtemas).map(function (si) { return { subtema: idx.s[si], total: t.subtemas[si] }; })
          .sort(function (a, b) { return b.total - a.total; })
      };
    }).sort(function (a, b) { return b.total - a.total; }),
    fuentes: fuentes.filter(function (f) { return f.total > 0; })
      .sort(function (a, b) { return b.fuente.localeCompare(a.fuente, 'es', { numeric: true }); })
  };
}

function getBanqueoCatalog(examId) {
  const courses = getExamCourses(examId);
  let ss = null;
  const out = courses.map(function (course) {
    try {
      // Solo se abre el Sheets si algún curso no está en caché
      const cache = CacheService.getScriptCache();
      if (!ss && !cache.get(banqueoCacheKey_(examId, course.name) + '_n')) ss = SpreadsheetApp.openById(EXAMS[examId].spreadsheetId);
      return summarizeCourseIndex_(course.name, getCourseIndex_(examId, course, ss));
    } catch (err) {
      return { name: course.name, total: 0, temas: [], fuentes: [], error: String(err) };
    }
  });
  return { exam: examId, courses: out, generatedAt: new Date().toISOString() };
}

function getBanqueoIds(examId, courseName, filters) {
  const course = findBanqueoCourse_(examId, courseName);
  if (!course) return { error: 'Curso no válido', items: [] };
  const idx = getCourseIndex_(examId, course);
  function keySet(list) {
    if (!list || !list.length) return null;
    const o = {};
    list.forEach(function (v) { o[labelKey_(v)] = true; });
    return o;
  }
  const fT = keySet(filters.temas), fS = keySet(filters.subtemas), fF = keySet(filters.fuentes);
  const tk = idx.t.map(labelKey_), sk = idx.s.map(labelKey_), fk = idx.f.map(labelKey_);
  const items = [];
  idx.r.forEach(function (r) {
    if (fT && !fT[tk[r[1]]]) return;
    if (fS && !fS[sk[r[2]]]) return;
    if (fF && !fF[fk[r[3]]]) return;
    items.push({ id: r[0], tema: idx.t[r[1]], subtema: idx.s[r[2]], fuente: idx.f[r[3]] });
  });
  return { exam: examId, course: courseName, total: items.length, items: items };
}

function getBanqueoPorIds(examId, courseName, ids) {
  const course = findBanqueoCourse_(examId, courseName);
  if (!course) return { error: 'Curso no válido', questions: [] };
  if (ids.length > BANQUEO_MAX_POR_IDS) return { error: 'Máximo ' + BANQUEO_MAX_POR_IDS + ' ids por llamada', questions: [] };
  const wanted = {};
  ids.forEach(function (id) { wanted[id] = null; });
  const ss = SpreadsheetApp.openById(EXAMS[examId].spreadsheetId);
  readBankRows(ss, course.sheets).forEach(function (q) {
    const id = rowId_(q);
    if (wanted.hasOwnProperty(id) && wanted[id] === null) wanted[id] = q;
  });
  const questions = [];
  const missing = [];
  ids.forEach(function (id) {
    const q = wanted[id];
    if (!q) { missing.push(id); return; }
    questions.push(formatQuestion(q, { id: id, number: questions.length + 1, subject: courseName, points: course.points }));
  });
  return { exam: examId, course: courseName, totalQuestions: questions.length, questions: questions, missing: missing };
}

// ============================================
// USUARIOS (Sheets ENCIB)
// ============================================
function registerUser(dni, fullName, email, phone, university) {
  if (!dni) return { registered: false, message: 'DNI requerido' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('usuarios');
  if (!sheet) {
    sheet = ss.insertSheet('usuarios');
    sheet.appendRow(['Fecha', 'DNI', 'Nombre', 'Email', 'Celular', 'Universidad']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  const data = sheet.getDataRange().getValues();
  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(dni) || data[i][1] === parseInt(dni)) { existingRow = i + 1; break; }
  }
  const timestamp = new Date();
  if (existingRow > 0) {
    const old = data[existingRow - 1];
    if (email !== old[3] || phone !== old[4] || university !== old[5]) {
      sheet.getRange(existingRow, 1).setValue(timestamp);
      sheet.getRange(existingRow, 4).setValue(email);
      sheet.getRange(existingRow, 5).setValue(phone);
      sheet.getRange(existingRow, 6).setValue(university);
      return { registered: true, message: 'Datos actualizados', updated: true };
    }
    return { registered: true, message: 'Usuario ya registrado', existing: true };
  }
  sheet.appendRow([timestamp, dni, fullName, email, phone, university]);
  return { registered: true, message: 'Usuario registrado', new: true };
}

// ============================================
// HISTORIAL (columna H = examen; vacía = ENCIB)
// ============================================
function getHistorySheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('historial_puntajes');
  if (!sheet) {
    sheet = ss.insertSheet('historial_puntajes');
    sheet.appendRow(['DNI', 'Fecha', 'Correctas', 'Total', 'Puntaje', 'Nota', 'Porcentaje', 'Examen']);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
  } else if (String(sheet.getRange(1, 8).getValue()).trim() === '') {
    sheet.getRange(1, 8).setValue('Examen').setFontWeight('bold');
  }
  return sheet;
}

function rowExam_(row) {
  const v = String(row[7] || '').toLowerCase().trim();
  return v || 'encib';
}

function saveUserScore(dni, correctAnswers, totalQuestions, rawScore, vigesimalScore, examId) {
  if (!dni) return { saved: false, message: 'DNI requerido' };
  const sheet = getHistorySheet_();
  const percentage = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;
  sheet.appendRow([dni, new Date(), correctAnswers, totalQuestions, rawScore, Number(vigesimalScore).toFixed(2), percentage + '%', examId || 'encib']);
  return { saved: true, message: 'Puntaje guardado' };
}

function getUserHistory(dni, examId) {
  const sheet = getHistorySheet_();
  const data = sheet.getDataRange().getValues();
  const history = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!(String(row[0]).trim() === String(dni) || row[0] === parseInt(dni))) continue;
    if (rowExam_(row) !== examId) continue;
    history.push({
      fecha: row[1],
      correctas: parseInt(row[2]) || 0,
      total: parseInt(row[3]) || 0,
      puntaje: parseFloat(row[4]) || 0,
      notaVigesimal: parseFloat(row[5]) || 0,
      porcentaje: parseFloat(row[6]) || 0,
      examen: rowExam_(row)
    });
  }
  history.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  const notas = history.map(function (h) { return h.notaVigesimal; });
  const puntajes = history.map(function (h) { return h.puntaje; });
  return {
    dni: dni, exam: examId, totalIntentos: history.length, history: history,
    mejorPuntaje: puntajes.length ? Math.max.apply(null, puntajes) : 0,
    mejorNota: notas.length ? Math.max.apply(null, notas) : 0,
    ultimoPuntaje: history.length ? history[0].puntaje : 0,
    ultimaNota: history.length ? history[0].notaVigesimal : 0
  };
}

// ============================================
// ACCESO — primer simulacro de cada examen gratis (DNI); lo demás, con la cuenta SINAPSIS
// ============================================
/**
 * Simulacro GRATIS (solo el primero por DNI y examen). Si concede acceso, agrega { token, tokenExpiresIn }:
 * token scope "sim" atado a DNI + email + examen, que permite UNA sola llamada a action=questions.
 * Los demás simulacros se rinden con la cuenta SINAPSIS (loginTicket).
 */
function checkUserAccess(dni, email, examId) {
  if (!dni) return { canAccess: false, reason: 'DNI requerido', attemptCount: 0 };
  examId = examId || 'encib';
  withLock_(function () { consumeQuota_('acc', dni, 1, LIMITS.ACCESOS_HORA, 0, 'verificaciones de acceso'); });
  const r = checkUserAccessRaw_(dni, email, examId);
  if (r.canAccess) {
    r.token = issueToken_({
      d: dni, e: (email || '').toLowerCase().trim(), s: 'sim', x: examId, f: true, n: 1
    });
    r.tokenExpiresIn = SIM_TOKEN_TTL_SECONDS;
  }
  return r;
}

function checkUserAccessRaw_(dni, email, examId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const emailLower = (email || '').toLowerCase().trim();

  // 1. Fraude: DNI con otro email, o email con otro DNI
  const usersSheet = ss.getSheetByName('usuarios');
  const dniToEmail = {};
  if (usersSheet) {
    const users = usersSheet.getDataRange().getValues();
    for (let i = 1; i < users.length; i++) {
      const rowDni = String(users[i][1]).trim();
      const rowEmail = String(users[i][3] || '').toLowerCase().trim();
      if (rowDni && rowEmail) dniToEmail[rowDni] = rowEmail;
      if (!rowEmail || !emailLower) continue;
      const sameDni = rowDni === dni || rowDni === String(parseInt(dni));
      if ((sameDni && rowEmail !== emailLower) || (!sameDni && rowEmail === emailLower)) {
        return { canAccess: false, reason: 'El usuario ya existe', attemptCount: 0, isFirstAttempt: false, isConfirmed: false, isFraudAttempt: true };
      }
    }
  }

  // 2. Intentos previos de ESTE examen (por DNI o por email)
  const hist = getHistorySheet_().getDataRange().getValues();
  let byDni = 0, byEmail = 0;
  for (let i = 1; i < hist.length; i++) {
    if (rowExam_(hist[i]) !== examId) continue;
    const histDni = String(hist[i][0]).trim();
    if (histDni === dni || histDni === String(parseInt(dni))) byDni++;
    if (emailLower && dniToEmail[histDni] === emailLower) byEmail++;
  }
  const attemptCount = Math.max(byDni, byEmail);

  if (attemptCount === 0) {
    return { canAccess: true, reason: 'Primer simulacro gratuito', attemptCount: 0, isFirstAttempt: true, isFraudAttempt: false };
  }
  // Más intentos: solo con la cuenta de sinapsisedu.com (loginTicket). La hoja "confirmado" ya no da acceso.
  return { canAccess: false, reason: 'Para más simulacros, entra con tu cuenta de sinapsisedu.com', attemptCount: attemptCount, isFirstAttempt: false, isConfirmed: false, isFraudAttempt: false };
}

/** Obsoleto: el banqueo ya no se abre con DNI + correo, sino con la cuenta de sinapsisedu.com (loginTicket). */
function checkBanqueoAccess() {
  return {
    canAccess: false, reason: 'Entra con tu cuenta de sinapsisedu.com', isConfirmed: false,
    loginUrl: SINAPSIS_LOGIN_URL
  };
}

// ============================================
// PRUEBAS (ejecutar desde el editor)
// ============================================
function testListExams() { console.log(JSON.stringify(listExams(), null, 2)); }
function testConfigs() { EXAM_ORDER.forEach(function (id) { const c = getConfig(id); console.log(id, c.totalQuestions, c.maxScore, c.courses.length); }); }
function testQuestionsEnam() { const q = getQuestions('enam'); console.log(q.length, JSON.stringify(q[0], null, 2)); }
function testBanqueoCatalog() {
  const t0 = Date.now();
  const cat = getBanqueoCatalog('enam');
  console.log('banqueoCatalog enam: ' + cat.courses.length + ' cursos en ' + (Date.now() - t0) + ' ms');
  cat.courses.forEach(function (c) {
    console.log(c.name + ': ' + c.total + ' preguntas, ' + c.temas.length + ' temas, fuentes: ' +
      c.fuentes.slice(0, 5).map(function (f) { return f.fuente + ' (' + f.total + ')'; }).join(', '));
  });
}
function testBanqueoIds() {
  const course = getExamCourses('enam')[0];
  const all = getBanqueoIds('enam', course.name, {});
  console.log(course.name + ': ' + all.total + ' ids. Primeros: ' + JSON.stringify(all.items.slice(0, 3)));
  if (!all.items.length) return;
  const tema = all.items[0].tema;
  const filtrado = getBanqueoIds('enam', course.name, { temas: [tema] });
  console.log('Tema "' + tema + '": ' + filtrado.total + ' ids');
  const ids = all.items.slice(0, 3).map(function (i) { return i.id; });
  const porIds = getBanqueoPorIds('enam', course.name, ids);
  console.log('porIds: ' + porIds.questions.length + ' de ' + ids.length + ', faltan ' + porIds.missing.length +
    '. Orden ok: ' + (porIds.questions.map(function (q) { return q.id; }).join(',') === ids.join(',')));
}
function clearBanqueoCache() {
  const cache = CacheService.getScriptCache();
  EXAM_ORDER.forEach(function (examId) {
    try {
      getExamCourses(examId).forEach(function (c) { cache.remove(banqueoCacheKey_(examId, c.name) + '_n'); });
    } catch (err) { console.log(examId + ': ' + err); }
  });
  console.log('Caché del banqueo borrada');
}
function clearConfigCache() { CacheService.getScriptCache().removeAll(EXAM_ORDER.map(function (id) { return 'cfg_' + id; })); }

/**
 * Desbloquea a un alumno que llegó a un límite diario: borra sus contadores de hoy.
 * Uso desde el editor: resetQuotasForDni('12345678')
 */
function resetQuotasForDni(dni) {
  const props = PropertiesService.getScriptProperties();
  const today = dayBucket_();
  props.getKeys().forEach(function (k) {
    if (k.indexOf('d:' + today + ':') === 0 && (k.slice(-(':' + dni).length) === ':' + dni)) props.deleteProperty(k);
  });
  CacheService.getScriptCache().remove('seen:' + dni + ':' + today);
  console.log('Cuotas diarias de ' + dni + ' reiniciadas (las horarias se liberan solas al cambiar la hora)');
}

/** Prueba del flujo seguro sin tocar las hojas (no guarda puntaje): token → banqueoIds → banqueoPorIds → errores. */
function testSecurityFlow() {
  const t = issueToken_({ d: 'TEST0000', e: 'test@example.com', s: 'cuenta', x: ['enam'] });
  const viejo = issueToken_({ d: 'TEST0000', e: 'test@example.com', s: 'banqueo', x: '*' });
  try { requireToken_(viejo, ['banqueo'], 'enam'); console.log('MAL: token banqueo por DNI aceptado'); } catch (e) { console.log('OK token viejo: ' + e.code); }
  const course = getExamCourses('enam')[0];
  const ids = getBanqueoIds('enam', course.name, {}).items.slice(0, 3).map(function (i) { return i.id; });
  consumeBanqueo_('TEST0000', ids);
  requireToken_(t, ['banqueo'], 'enam');
  console.log('Token cuenta OK, ' + ids.length + ' preguntas cobradas a la cuota');
  const tsim = issueToken_({ d: 'TEST0000', e: 'test@example.com', s: 'sim', x: 'enam', f: true, n: 1 });
  try { requireToken_(tsim, ['banqueo'], 'enam'); console.log('MAL: scope no validado'); } catch (e) { console.log('OK scope: ' + e.code); }
  try { requireToken_('', ['banqueo'], 'enam'); console.log('MAL: token vacío aceptado'); } catch (e) { console.log('OK vacío: ' + e.code); }
  try { requireToken_(newSecret_(), ['banqueo'], 'enam'); console.log('MAL: token falso aceptado'); } catch (e) { console.log('OK falso: ' + e.code); }
  const q = stripAnswers_(formatQuestion(readBankRows(SpreadsheetApp.openById(EXAMS.enam.spreadsheetId), course.sheets)[0], { number: 1, subject: course.name, points: 1 }));
  console.log('Simulacro sin respuesta: ' + (q.correctAnswer === undefined && q.justification === undefined ? 'OK' : 'MAL'));

  // loginTicket: formato inválido (no llama a sinapsisedu.com), ticket bien formado pero rechazado (stub), ticket válido (stub)
  const llamadas = [];
  const rechaza = function (tk) { llamadas.push(tk); return { ok: false, error: 'Ticket inválido o vencido' }; };
  try { loginTicket_('falso', rechaza); console.log('MAL: ticket con formato inválido aceptado'); } catch (e) { console.log('OK ticket formato: ' + e.code + (llamadas.length ? ' (MAL: llamó al backend)' : '')); }
  const bogus = (newSecret_() + 'ABCDEFGHIJKLMNOP').slice(0, 48);
  try { loginTicket_(bogus, rechaza); console.log('MAL: ticket falso aceptado'); } catch (e) { console.log('OK ticket falso: ' + e.code + ' (backend consultado ' + llamadas.length + ' vez)'); }
  try {
    loginTicket_(bogus, function () { return { ok: true, data: { id_usuario: 'TEST', exams: ['otro'] } }; });
    console.log('MAL: cuenta sin exámenes válidos aceptada');
  } catch (e) { console.log('OK cuenta sin exámenes: ' + e.code); }
  const lt = loginTicket_(bogus, function () {
    return { ok: true, data: { id_usuario: 'TEST', correo: 'Test@Example.com', nombre: 'Test', dni: '00000000', exams: ['enam', 'otro'], fin: { enam: '2099-01-01' } } };
  });
  console.log('loginTicket stub: exams=' + JSON.stringify(lt.exams) + (lt.exams.join() === 'enam' ? ' OK' : ' MAL'));
  try { requireToken_(lt.token, ['banqueo'], 'enam'); requireToken_(lt.token, ['sim'], 'enam'); console.log('OK cuenta vale para banqueo y simulacro de enam'); } catch (e) { console.log('MAL cuenta enam: ' + e.code); }
  try { requireToken_(lt.token, ['banqueo'], 'rm'); console.log('MAL: cuenta abrió un examen que no compró'); } catch (e) { console.log('OK otro examen: ' + e.code); }
  const ti = readToken_(lt.token);
  console.log('Identidad de la cuenta: ' + ti.d + (ti.d === 'U:TEST' ? ' OK' : ' MAL'));
  CacheService.getScriptCache().remove('tok:' + lt.token);

  // Checks de DNI + correo ya no abren el banqueo
  console.log('checkBanqueoAccess sin acceso: ' + (checkBanqueoAccess().canAccess === false ? 'OK' : 'MAL'));

  // Calificación gratis: nota y desglose por curso, sin clave de respuestas (no guarda puntaje)
  const att = { d: 'TEST0000', x: 'enam', f: true, q: [['a', 1, 1, 'Cardio'], ['b', 2, 1, 'Cardio'], ['c', 0, 2, 'Pediatría']] };
  const g = buildGradeResult_(att, '12-', 'enam', 'x', null);
  const sinClave = g.results.every(function (r) { return r.correctAnswer === undefined && r.justification === undefined && typeof r.correct === 'boolean'; });
  console.log('Gratis sin clave: ' + (sinClave && g.free ? 'OK' : 'MAL') + ' · ' + g.correctAnswers + '/' + g.totalQuestions +
    ' · cursos ' + JSON.stringify(g.courses));
  const gp = buildGradeResult_({ d: 'U:TEST', x: 'enam', f: false, q: att.q }, '12-', 'enam', 'x', ['j1', 'j2', null]);
  console.log('Pagado con clave: ' + (gp.results[0].correctAnswer === 1 && gp.results[0].justification === 'j1' && !gp.free ? 'OK' : 'MAL'));

  CacheService.getScriptCache().removeAll(['tok:' + t, 'tok:' + viejo, 'tok:' + tsim]);
  resetQuotasForDni('TEST0000');
}
