/**
 * SimulaENCIB - API REST para Google Apps Script
 * Examen Nacional de Ciencias Básicas
 *
 * INSTRUCCIONES DE CONFIGURACIÓN:
 * 1. Crear un nuevo proyecto en Google Apps Script (script.google.com)
 * 2. Copiar este código en el archivo Code.gs
 * 3. Actualizar SPREADSHEET_ID con el ID de tu Google Sheets
 * 4. Implementar como aplicación web:
 *    - Extensiones > Apps Script > Implementar > Nueva implementación
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 5. Copiar la URL generada y usarla en el frontend
 */

// ============================================
// CONFIGURACIÓN - ACTUALIZAR CON TU SPREADSHEET
// ============================================
const SPREADSHEET_ID = '1S0HFMTZQ5wk4u5idfEH-NGKkmzG0Rp1OnBJMd7IFwWI';

// Configuración de cursos ENCIB (8 cursos, 100 preguntas total)
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

// Orden de cursos para el examen
const COURSE_ORDER = [
  'Anatomía', 'Embriología', 'Histología', 'Bioquímica',
  'Fisiología', 'Patología', 'Farmacología', 'Microbiología-Parasitología'
];

// ============================================
// FUNCIÓN PRINCIPAL - ENDPOINT REST
// ============================================
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      case 'config':
        result = getConfig();
        break;
      case 'questions':
        // ENCIB no tiene áreas - siempre es el mismo examen
        result = getQuestions();
        break;
      case 'register':
        const dni = e.parameter.dni || '';
        const fullName = e.parameter.fullName || '';
        const email = e.parameter.email || '';
        const phone = e.parameter.phone || '';
        const university = e.parameter.university || '';
        result = registerUser(dni, fullName, email, phone, university);
        break;
      case 'saveScore':
        const scoreDni = e.parameter.dni || '';
        const correctAnswers = parseInt(e.parameter.correctAnswers) || 0;
        const totalQuestions = parseInt(e.parameter.totalQuestions) || 100;
        const rawScore = parseInt(e.parameter.rawScore) || 0;
        const vigesimalScore = parseFloat(e.parameter.vigesimalScore) || 0;
        result = saveUserScore(scoreDni, correctAnswers, totalQuestions, rawScore, vigesimalScore);
        break;
      case 'getHistory':
        const historyDni = e.parameter.dni || '';
        if (!historyDni) {
          return createErrorResponse('Parámetro "dni" requerido');
        }
        result = getUserHistory(historyDni);
        break;
      case 'test':
        result = { status: 'ok', message: 'SimulaENCIB API funcionando correctamente', timestamp: new Date().toISOString() };
        break;
      default:
        return createErrorResponse('Acción no válida. Use: config, questions, register, saveScore, getHistory, o test');
    }

    return createSuccessResponse(result);

  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// ============================================
// FUNCIONES DE RESPUESTA
// ============================================
function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// OBTENER CONFIGURACIÓN DEL EXAMEN ENCIB
// ============================================
function getConfig() {
  const courses = COURSE_ORDER.map(courseName => ({
    code: COURSE_CONFIG[courseName].code,
    name: courseName,
    questionCount: COURSE_CONFIG[courseName].questionCount
  }));

  const totalQuestions = courses.reduce((sum, c) => sum + c.questionCount, 0);

  return {
    totalQuestions: totalQuestions,
    maxScore: totalQuestions, // 1 punto por pregunta
    courses: courses
  };
}

// ============================================
// OBTENER PREGUNTAS DEL EXAMEN ENCIB (100 preguntas, 8 cursos)
// ============================================
function getQuestions() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const questions = [];
  let questionNumber = 1;

  // Recorrer cursos en orden
  for (const courseName of COURSE_ORDER) {
    const config = COURSE_CONFIG[courseName];
    const courseQuestions = getRandomQuestionsFromCourse(ss, courseName, config, questionNumber);
    questions.push(...courseQuestions);
    questionNumber += courseQuestions.length;
  }

  // NO mezclar - mantener orden por curso
  return questions;
}

// ============================================
// OBTENER PREGUNTAS ALEATORIAS DE UN CURSO
// ============================================
function getRandomQuestionsFromCourse(ss, courseName, config, startingNumber) {
  const sheet = ss.getSheetByName(config.sheetName);
  if (!sheet) {
    console.log(`Advertencia: Hoja "${config.sheetName}" no encontrada`);
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Solo encabezado o vacía

  const headers = data[0];

  // Encontrar índices de columnas
  const colIndices = {
    questionText: headers.indexOf('Question Text'),
    questionType: headers.indexOf('Question Type'),
    option1: headers.indexOf('Option 1'),
    option2: headers.indexOf('Option 2'),
    option3: headers.indexOf('Option 3'),
    option4: headers.indexOf('Option 4'),
    option5: headers.indexOf('Option 5'),
    correctAnswer: headers.indexOf('Correct Answer'),
    timeSeconds: headers.indexOf('Time in seconds'),
    imageLink: headers.indexOf('Image Link'),
    numero: headers.indexOf('NUMERO'),
    tema: headers.indexOf('TEMA'),
    subtema: headers.indexOf('SUBTEMA'),
    sourceFile: headers.indexOf('NOMBRE DEL ARCHIVO')
  };

  // Obtener todas las preguntas válidas
  const allQuestions = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const questionText = row[colIndices.questionText];

    // Saltar filas sin pregunta
    if (!questionText || questionText === '') continue;

    allQuestions.push({
      rowIndex: i,
      data: row
    });
  }

  // Seleccionar N preguntas aleatorias
  const selectedQuestions = selectRandomItems(allQuestions, config.questionCount);

  // Formatear preguntas (1 punto por correcta en ENCIB)
  return selectedQuestions.map((q, index) => {
    const row = q.data;

    // Crear opciones (5 alternativas)
    const options = [
      row[colIndices.option1],
      row[colIndices.option2],
      row[colIndices.option3],
      row[colIndices.option4],
      row[colIndices.option5]
    ].filter(opt => opt && opt !== '');

    // La respuesta correcta es el índice 1-based, convertir a 0-based
    const correctAnswerIndex = (parseInt(row[colIndices.correctAnswer]) || 1) - 1;

    return {
      id: `${courseName}-${q.rowIndex}`,
      number: startingNumber + index,
      questionText: row[colIndices.questionText],
      questionType: row[colIndices.questionType] || 'Caso Clínico',
      options: options,
      correctAnswer: correctAnswerIndex,
      timeSeconds: 180,
      imageLink: row[colIndices.imageLink] || null,
      subject: courseName,
      points: 1, // Siempre 1 punto en ENCIB
      sourceFile: row[colIndices.sourceFile] || null,
      metadata: {
        numero: row[colIndices.numero],
        tema: row[colIndices.tema],
        subtema: row[colIndices.subtema]
      }
    };
  });
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Mezcla un array usando el algoritmo Fisher-Yates
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Selecciona N elementos aleatorios de un array
 */
function selectRandomItems(array, count) {
  if (count >= array.length) {
    return shuffleArray(array);
  }

  const shuffled = shuffleArray(array);
  return shuffled.slice(0, count);
}

// ============================================
// REGISTRO DE USUARIOS
// ============================================

/**
 * Registra un usuario en la hoja "usuarios"
 * Columnas: Fecha | DNI | Nombre | Email | Celular | Universidad
 */
function registerUser(dni, fullName, email, phone, university) {
  if (!dni) {
    return { registered: false, message: 'DNI requerido' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('usuarios');

  // Crear hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet('usuarios');
    sheet.appendRow(['Fecha', 'DNI', 'Nombre', 'Email', 'Celular', 'Universidad']);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold');
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(3, 250);
    sheet.setColumnWidth(4, 220);
    sheet.setColumnWidth(6, 350);
  }

  // Buscar si el DNI ya existe
  const data = sheet.getDataRange().getValues();
  let existingRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === dni || data[i][1] === parseInt(dni)) {
      existingRow = i + 1;
      break;
    }
  }

  const timestamp = new Date();

  if (existingRow > 0) {
    // Usuario existe - actualizar datos
    const oldEmail = data[existingRow - 1][3];
    const oldPhone = data[existingRow - 1][4];
    const oldUniversity = data[existingRow - 1][5];

    if (email !== oldEmail || phone !== oldPhone || university !== oldUniversity) {
      sheet.getRange(existingRow, 1).setValue(timestamp);
      sheet.getRange(existingRow, 4).setValue(email);
      sheet.getRange(existingRow, 5).setValue(phone);
      sheet.getRange(existingRow, 6).setValue(university);
      return { registered: true, message: 'Datos actualizados', updated: true };
    }

    return { registered: true, message: 'Usuario ya registrado', existing: true };
  }

  // Usuario nuevo
  sheet.appendRow([timestamp, dni, fullName, email, phone, university]);

  return { registered: true, message: 'Usuario registrado', new: true };
}

// ============================================
// HISTORIAL DE PUNTAJES
// ============================================

/**
 * Guarda el puntaje de un usuario en la hoja "historial_puntajes"
 * Formato ENCIB: DNI | Fecha | Correctas | Total | Puntaje Bruto | Nota Vigesimal | Porcentaje
 */
function saveUserScore(dni, correctAnswers, totalQuestions, rawScore, vigesimalScore) {
  if (!dni) {
    return { saved: false, message: 'DNI requerido' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('historial_puntajes');

  // Crear hoja si no existe
  if (!sheet) {
    sheet = ss.insertSheet('historial_puntajes');
    sheet.appendRow(['DNI', 'Fecha', 'Correctas', 'Total', 'Puntaje', 'Nota Vigesimal', 'Porcentaje']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 150);
  }

  // Calcular porcentaje
  const percentage = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;

  // Agregar nuevo registro
  const timestamp = new Date();
  sheet.appendRow([
    dni,
    timestamp,
    correctAnswers,
    totalQuestions,
    rawScore,
    vigesimalScore.toFixed(2),
    percentage + '%'
  ]);

  return { saved: true, message: 'Puntaje guardado' };
}

/**
 * Obtiene el historial de puntajes de un usuario por DNI
 */
function getUserHistory(dni) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('historial_puntajes');

  if (!sheet) {
    return { history: [], message: 'No hay historial disponible' };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { history: [], message: 'No hay registros' };
  }

  // Buscar registros del usuario
  const history = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === dni || row[0] === parseInt(dni)) {
      history.push({
        fecha: row[1],
        correctas: parseInt(row[2]) || 0,
        total: parseInt(row[3]) || 100,
        puntaje: parseInt(row[4]) || 0,
        notaVigesimal: parseFloat(row[5]) || 0,
        porcentaje: parseFloat(row[6]) || 0
      });
    }
  }

  // Ordenar por fecha (más reciente primero)
  history.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Calcular mejor nota vigesimal
  const mejorNota = history.length > 0 ? Math.max(...history.map(h => h.notaVigesimal)) : 0;
  const mejorPuntaje = history.length > 0 ? Math.max(...history.map(h => h.puntaje)) : 0;

  return {
    dni: dni,
    totalIntentos: history.length,
    history: history,
    mejorPuntaje: mejorPuntaje,
    mejorNota: mejorNota,
    ultimoPuntaje: history.length > 0 ? history[0].puntaje : 0,
    ultimaNota: history.length > 0 ? history[0].notaVigesimal : 0
  };
}

// ============================================
// FUNCIONES DE PRUEBA
// ============================================

function testGetConfig() {
  const config = getConfig();
  console.log(JSON.stringify(config, null, 2));
}

function testGetQuestions() {
  const questions = getQuestions();
  console.log(`Total preguntas: ${questions.length}`);
  console.log(JSON.stringify(questions.slice(0, 2), null, 2));
}

function testDoGet() {
  const configResult = doGet({ parameter: { action: 'config' } });
  console.log('Config:', configResult.getContent());

  const questionsResult = doGet({ parameter: { action: 'questions' } });
  console.log('Questions:', questionsResult.getContent());
}
