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

// ============================================
// ENDPOINT REST
// ============================================
function doGet(e) {
  try {
    const p = e.parameter || {};
    const action = p.action;
    const examId = resolveExamId(p.exam);
    let result;

    switch (action) {
      case 'exams':
        result = listExams();
        break;
      case 'config':
        result = getConfig(examId);
        break;
      case 'questions':
        result = getQuestions(examId);
        break;
      case 'register':
        result = registerUser(p.dni || '', p.fullName || '', p.email || '', p.phone || '', p.university || '');
        break;
      case 'saveScore':
        result = saveUserScore(
          p.dni || '',
          parseInt(p.correctAnswers) || 0,
          parseInt(p.totalQuestions) || 100,
          parseFloat(p.rawScore) || 0,
          parseFloat(p.vigesimalScore) || 0,
          examId
        );
        break;
      case 'getHistory':
        if (!p.dni) return createErrorResponse('Parámetro "dni" requerido');
        result = getUserHistory(p.dni, examId);
        break;
      case 'checkAccess':
        if (!p.dni) return createErrorResponse('Parámetro "dni" requerido');
        result = checkUserAccess(p.dni, p.email || '', examId);
        break;
      case 'checkBanqueoAccess':
        if (!p.dni) return createErrorResponse('Parámetro "dni" requerido');
        result = checkBanqueoAccess(p.dni, p.email || '');
        break;
      case 'getBanqueoQuestions':
        if (!p.course) return createErrorResponse('Parámetro "course" requerido');
        result = getBanqueoQuestions(p.course, examId);
        break;
      case 'banqueoCatalog':
        result = getBanqueoCatalog(examId);
        break;
      case 'banqueoIds':
        if (!p.course) return createErrorResponse('Parámetro "course" requerido');
        result = getBanqueoIds(examId, p.course, {
          temas: splitList_(p.temas, '|'),
          subtemas: splitList_(p.subtemas, '|'),
          fuentes: splitList_(p.fuentes, '|')
        });
        break;
      case 'banqueoPorIds':
        if (!p.course) return createErrorResponse('Parámetro "course" requerido');
        if (!p.ids) return createErrorResponse('Parámetro "ids" requerido');
        result = getBanqueoPorIds(examId, p.course, splitList_(p.ids, ','));
        break;
      case 'test':
        result = { status: 'ok', message: 'API SINAPSIS multi-examen funcionando', exams: EXAM_ORDER, timestamp: new Date().toISOString() };
        break;
      default:
        return createErrorResponse('Acción no válida. Use: exams, config, questions, register, saveScore, getHistory, checkAccess, checkBanqueoAccess, getBanqueoQuestions, banqueoCatalog, banqueoIds, banqueoPorIds o test');
    }
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(error.toString());
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

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
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
function getBanqueoQuestions(courseName, examId) {
  const exam = EXAMS[examId];
  const course = getExamCourses(examId).filter(function (c) { return c.name === courseName; })[0];
  if (!course) return { error: 'Curso no válido', questions: [] };

  const ss = SpreadsheetApp.openById(exam.spreadsheetId);
  const pool = readBankRows(ss, course.sheets);
  if (!pool.length) return { error: 'No hay preguntas disponibles', questions: [] };

  const usedIds = {};
  const questions = selectRandomItems(pool, 10).map(function (q, i) {
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

function cachePutChunked_(cache, key, str) {
  const parts = {};
  const n = Math.ceil(str.length / BANQUEO_CHUNK) || 1;
  for (let i = 0; i < n; i++) parts[key + '_' + i] = str.substr(i * BANQUEO_CHUNK, BANQUEO_CHUNK);
  parts[key + '_n'] = String(n);
  try { cache.putAll(parts, BANQUEO_CACHE_SECONDS); } catch (err) { console.log('Cache llena: ' + err); }
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
// ACCESO — primer simulacro de cada examen gratis; luego solo "confirmado"
// ============================================
function isConfirmed_(ss, dni, emailLower) {
  let sheet = ss.getSheetByName('confirmado');
  if (!sheet) {
    sheet = ss.insertSheet('confirmado');
    sheet.appendRow(['DNI', 'Nombre', 'Email']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    return false;
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const confDni = String(data[i][0]).trim();
    const confEmail = String(data[i][2] || '').toLowerCase().trim();
    const dniMatch = confDni === dni || confDni === String(parseInt(dni));
    const emailMatch = confEmail === emailLower || (confEmail === '' && emailLower === '');
    if (dniMatch && emailMatch) return true;
  }
  return false;
}

function checkUserAccess(dni, email, examId) {
  if (!dni) return { canAccess: false, reason: 'DNI requerido', attemptCount: 0 };
  examId = examId || 'encib';
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
  if (isConfirmed_(ss, dni, emailLower)) {
    return { canAccess: true, reason: 'Usuario confirmado', attemptCount: attemptCount, isFirstAttempt: false, isConfirmed: true, isFraudAttempt: false };
  }
  return { canAccess: false, reason: 'Requiere inscripción para más intentos', attemptCount: attemptCount, isFirstAttempt: false, isConfirmed: false, isFraudAttempt: false };
}

function checkBanqueoAccess(dni, email) {
  if (!dni) return { canAccess: false, reason: 'DNI requerido' };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ok = isConfirmed_(ss, dni, (email || '').toLowerCase().trim());
  return ok
    ? { canAccess: true, reason: 'Acceso autorizado al Banqueo', isConfirmed: true }
    : { canAccess: false, reason: 'El Banqueo es exclusivo para usuarios inscritos', isConfirmed: false };
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
