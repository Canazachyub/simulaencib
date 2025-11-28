# SimulaUNA - Plataforma de Simulacros de Examen de Admisión

Plataforma web para realizar simulacros del examen de admisión de la **Universidad Nacional del Altiplano (UNA) Puno, Perú**. Permite a los estudiantes practicar con preguntas reales organizadas por área académica y recibir retroalimentación detallada de su desempeño.

## Tabla de Contenidos

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Configuración del Backend (Google Sheets + Apps Script)](#configuración-del-backend-google-sheets--apps-script)
- [Configuración del Frontend](#configuración-del-frontend)
- [Áreas y Asignaturas](#áreas-y-asignaturas)
- [Flujo de la Aplicación](#flujo-de-la-aplicación)
- [Sistema de Puntuación](#sistema-de-puntuación)
- [Sistema de Usuarios y Historial](#sistema-de-usuarios-y-historial)
- [Despliegue](#despliegue)
- [Desarrollo Local](#desarrollo-local)

---

## Características

### Examen
- **60 preguntas** por simulacro organizadas por asignatura
- **3 áreas académicas**: Ingenierías, Sociales, Biomédicas
- **18 asignaturas** con preguntas ponderadas según el área
- **Cronómetro global** que cuenta el tiempo total del examen (estilo Google Forms)
- **Navegación libre** entre preguntas (avanzar/retroceder)
- **Sin feedback inmediato** - el estudiante no sabe si respondió bien hasta calificar
- **Soporte para imágenes** en las preguntas (mediante links)
- **Indicador de fuente** - muestra de qué examen se extrajo cada pregunta ("Tomado en: Examen_2024.pdf")
- **Botón de WhatsApp** para reportar errores en preguntas
- **Soporte de formato HTML** en preguntas: `<b>`, `<i>`, `<u>`, `<mark>`, `<br>`, `<sub>`, `<sup>`

### Registro de Usuario
- **Datos personales**: DNI (8 dígitos), Nombre completo, Email, Celular
- **Tipo de proceso**: CEPREUNA, GENERAL, EXTRAORDINARIO
- **Área académica**: Ingenierías, Biomédicas, Sociales
- **Carrera profesional**: Lista filtrada por área (40+ carreras)
- **Sin duplicados**: Si el DNI ya existe, solo actualiza datos si cambiaron

### Resultados
- **Puntaje total** con desglose por asignatura
- **Gráfico de barras** de rendimiento por materia (Recharts)
- **Navegador visual de preguntas** (verde=correcta, rojo=incorrecta)
- **Revisión detallada** de cada pregunta con la respuesta correcta
- **Nivel de desempeño**: Excelente, Bueno, Regular, Necesita práctica
- **Generación de PDF** con el reporte completo (jsPDF)
- **Estadísticas**: tiempo total, promedio por pregunta, correctas/incorrectas

### Historial de Puntajes (NUEVO)
- **Tracking por DNI**: Cada intento se guarda automáticamente
- **Stats cards**: Total simulacros, Mejor puntaje, vs Anterior
- **Gráfico de línea**: Evolución de puntajes a lo largo del tiempo
- **Tabla de historial**: Fecha, Área, Correctas, Puntaje de cada intento
- **Indicador de mejor puntaje**: Trofeo en el puntaje más alto

### Técnicas
- **Modo mock** para desarrollo sin backend
- **Preguntas aleatorias** seleccionadas del banco de cada asignatura
- **Orden por asignatura** según tabla de configuración (no aleatorio)
- **Responsive design** para móviles y desktop
- **Colores Google** en opciones de respuesta (A=azul, B=rosa, C=ámbar, D=verde, E=púrpura)

---

## Tecnologías

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 18.3.1 | Framework UI |
| TypeScript | 5.6.2 | Tipado estático |
| Vite | 5.4.10 | Build tool |
| Tailwind CSS | 3.4.14 | Estilos |
| Zustand | 5.0.1 | Estado global |
| React Router | 6.28.0 | Navegación |
| Recharts | 2.13.3 | Gráficos (BarChart, LineChart) |
| jsPDF | 2.5.2 | Generación PDF |
| Lucide React | 0.460.0 | Iconos |
| clsx | 2.1.1 | Clases condicionales |

### Backend
| Tecnología | Uso |
|------------|-----|
| Google Sheets | Base de datos (preguntas, usuarios, historial) |
| Google Apps Script | API REST (doGet) |

---

## Arquitectura

```
┌─────────────────┐         ┌──────────────────────┐
│                 │   GET   │                      │
│   React App     │◄───────►│  Google Apps Script  │
│   (Frontend)    │  JSON   │      (API REST)      │
│                 │         │                      │
└─────────────────┘         └──────────┬───────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │   Google Sheets      │
                            │   (Base de datos)    │
                            │                      │
                            │  - Configuración x3  │
                            │  - Banco preguntas   │
                            │  - usuarios          │
                            │  - historial_puntajes│
                            └──────────────────────┘
```

### Endpoints de la API

| Endpoint | Parámetros | Descripción |
|----------|------------|-------------|
| `?action=config` | - | Obtiene configuración de todas las áreas |
| `?action=questions&area=X` | area | Obtiene 60 preguntas aleatorias del área X |
| `?action=register` | dni, fullName, email, phone, processType, area, career | Registra usuario (sin duplicar por DNI) |
| `?action=saveScore` | dni, score, maxScore, area, correct, total | Guarda puntaje en historial |
| `?action=getHistory&dni=X` | dni | Obtiene historial de puntajes del usuario |
| `?action=test` | - | Verifica conexión con la API |

---

## Estructura del Proyecto

```
simulauna/
├── src/
│   ├── components/           # Componentes React
│   │   ├── Landing.tsx       # Página de inicio con features
│   │   ├── StudentForm.tsx   # Formulario 2 pasos (datos + área/carrera)
│   │   ├── AreaSelector.tsx  # Cards de selección de área
│   │   ├── ExamConfirmation.tsx  # Confirmación antes del examen
│   │   ├── Quiz.tsx          # Examen con navegador y cronómetro
│   │   ├── Question.tsx      # Pregunta individual con formato HTML
│   │   ├── Results.tsx       # Resultados con 4 tabs (Revisión, Gráfico, Detalle, Historial)
│   │   ├── PDFGenerator.tsx  # Generador de reporte PDF
│   │   └── index.ts          # Exports
│   │
│   ├── hooks/
│   │   ├── useExam.ts        # Store Zustand: estado del examen
│   │   └── useTimer.ts       # Hook useStopwatch para cronómetro
│   │
│   ├── services/
│   │   └── api.ts            # Cliente API: fetchConfig, fetchQuestions,
│   │                         # registerUser, saveScore, getUserHistory
│   │
│   ├── types/
│   │   └── index.ts          # Interfaces: Question, Answer, Student, etc.
│   │
│   ├── utils/
│   │   └── calculations.ts   # formatTime, formatNumber, indexToLetter, etc.
│   │
│   ├── App.tsx               # Router principal (5 rutas)
│   ├── main.tsx              # Entry point
│   └── index.css             # Estilos globales + animaciones
│
├── google-apps-script/
│   └── api.gs                # Backend completo (copiar a Apps Script)
│
├── public/
│   └── favicon.svg
│
├── .env.example              # Variables de entorno ejemplo
├── package.json
├── tailwind.config.js        # Incluye safelist para colores dinámicos
├── vite.config.ts
└── tsconfig.json
```

---

## Configuración del Backend (Google Sheets + Apps Script)

### 1. Crear Google Sheets

Crear un spreadsheet con las siguientes hojas:

#### Hojas de Configuración (3)
- `Configuración_Ingenierías`
- `Configuración_Sociales`
- `Configuración_Biomédicas`

**Columnas requeridas:**
| COD. | ASIGNATURA | PREGUNTA BIEN CONTESTADA | CANTIDAD DE PREGUNTAS | PONDERACIÓN | PUNTAJE |
|------|------------|--------------------------|----------------------|-------------|---------|
| 1 | Aritmética | 10 | 4 | 5.201 | 208.04 |
| ... | ... | ... | ... | ... | ... |

#### Hojas de Banco de Preguntas (18)
- `Banco_Aritmética`
- `Banco_Álgebra`
- `Banco_Geometría`
- `Banco_Trigonometría`
- `Banco_Física`
- `Banco_Química`
- `Banco_Biología y Anatomía`
- `Banco_Psicología y Filosofía`
- `Banco_Geografía`
- `Banco_Historia`
- `Banco_Educación Cívica`
- `Banco_Economía`
- `Banco_Comunicación`
- `Banco_Literatura`
- `Banco_Razonamiento Matemático`
- `Banco_Razonamiento Verbal`
- `Banco_Inglés`
- `Banco_Quechua y aimara`

**Columnas requeridas para cada banco:**
| Question Text | Question Type | Option 1 | Option 2 | Option 3 | Option 4 | Option 5 | Correct Answer | Time in seconds | Image Link | NUMERO | CURSO | TEMA | SUBTEMA | NOMBRE DEL ARCHIVO |
|--------------|---------------|----------|----------|----------|----------|----------|----------------|-----------------|------------|--------|-------|------|---------|-------------------|
| ¿Cuál es...? | Multiple Choice | Opción A | Opción B | Opción C | Opción D | Opción E | 3 | 180 | https://... | 1 | Aritmética | Números | Naturales | Examen_2024.pdf |

> **Nota:** `Correct Answer` es 1-based (1=Option 1, 2=Option 2, etc.)

#### Hoja de Usuarios (creada automáticamente)
- `usuarios`

**Columnas:**
| Fecha | DNI | Nombre | Email | Celular | Proceso | Área | Carrera |
|-------|-----|--------|-------|---------|---------|------|---------|

#### Hoja de Historial de Puntajes (creada automáticamente)
- `historial_puntajes`

**Columnas:**
| DNI | Fecha | Área | Puntaje | Puntaje Máx | Correctas | Total | Porcentaje |
|-----|-------|------|---------|-------------|-----------|-------|------------|

### 2. Configurar Google Apps Script

1. Ir a [script.google.com](https://script.google.com)
2. Crear nuevo proyecto
3. Copiar el contenido de `google-apps-script/api.gs`
4. Actualizar `SPREADSHEET_ID` con el ID de tu Google Sheets:
   ```javascript
   const SPREADSHEET_ID = 'TU_ID_DEL_SPREADSHEET';
   ```
5. Desplegar como aplicación web:
   - Implementar > Nueva implementación
   - Tipo: Aplicación web
   - Ejecutar como: Yo
   - Quién tiene acceso: **Cualquier persona**
6. Copiar la URL generada

---

## Configuración del Frontend

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```

Editar `.env`:
```env
# URL de tu Google Apps Script desplegado
VITE_API_URL=https://script.google.com/macros/s/TU_SCRIPT_ID/exec

# Usar datos mock (true para desarrollo, false para producción)
VITE_USE_MOCK=true
```

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

### 4. Compilar para producción
```bash
npm run build
```

---

## Áreas y Asignaturas

### Distribución de Preguntas por Área

#### Ingenierías (60 preguntas, 3000 pts máx)
| Asignatura | Preguntas |
|------------|-----------|
| Aritmética | 4 |
| Álgebra | 4 |
| Geometría | 4 |
| Trigonometría | 4 |
| Física | 4 |
| Química | 4 |
| Biología y Anatomía | 2 |
| Psicología y Filosofía | 4 |
| Geografía | 2 |
| Historia | 2 |
| Educación Cívica | 2 |
| Economía | 2 |
| Comunicación | 4 |
| Literatura | 2 |
| Razonamiento Matemático | 6 |
| Razonamiento Verbal | 6 |
| Inglés | 2 |
| Quechua y aimara | 2 |

#### Biomédicas (60 preguntas, 3000 pts máx)
| Asignatura | Preguntas |
|------------|-----------|
| Aritmética | 3 |
| Álgebra | 3 |
| Geometría | 3 |
| Trigonometría | 3 |
| Física | 3 |
| Química | 5 |
| Biología y Anatomía | 6 |
| Psicología y Filosofía | 4 |
| Geografía | 2 |
| Historia | 2 |
| Educación Cívica | 2 |
| Economía | 2 |
| Comunicación | 4 |
| Literatura | 2 |
| Razonamiento Matemático | 6 |
| Razonamiento Verbal | 6 |
| Inglés | 2 |
| Quechua y aimara | 2 |

#### Sociales (60 preguntas, 3000 pts máx)
| Asignatura | Preguntas |
|------------|-----------|
| Aritmética | 3 |
| Álgebra | 3 |
| Geometría | 2 |
| Trigonometría | 2 |
| Física | 2 |
| Química | 2 |
| Biología y Anatomía | 2 |
| Psicología y Filosofía | 4 |
| Geografía | 4 |
| Historia | 4 |
| Educación Cívica | 4 |
| Economía | 4 |
| Comunicación | 4 |
| Literatura | 4 |
| Razonamiento Matemático | 6 |
| Razonamiento Verbal | 6 |
| Inglés | 2 |
| Quechua y aimara | 2 |

### Carreras por Área

#### Ingenierías (17 carreras)
- Ingeniería Agronómica, Económica, de Minas, Geológica, Metalúrgica, Química
- Ingeniería Estadística e Informática, Topográfica, Agroindustrial, Agrícola
- Ingeniería Civil, de Sistemas, Mecánica Eléctrica, Electrónica
- Arquitectura y Urbanismo
- Ciencias Físico Matemáticas: Física, Matemáticas

#### Biomédicas (8 carreras)
- Medicina Veterinaria y Zootecnia, Enfermería
- Biología: Pesquería, Microbiología, Ecología
- Medicina Humana, Nutrición Humana, Odontología

#### Sociales (17 carreras)
- Ciencias Contables, Trabajo Social
- Educación: Primaria, Inicial, Física, Secundaria (3 especialidades)
- Antropología, Derecho, Turismo
- Ciencias de la Comunicación Social, Administración
- Arte: Música, Artes Plásticas, Danza
- Psicología

---

## Flujo de la Aplicación

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Landing    │───►│  Registro    │───►│  Selección   │
│   (/)        │    │  Paso 1:     │    │  Paso 2:     │
│              │    │  DNI+Nombre  │    │  Proceso+    │
│              │    │  Email+Tel   │    │  Área+Carrera│
└──────────────┘    └──────────────┘    └──────────────┘
                                               │
                                               ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Resultados  │◄───│   Examen     │◄───│ Confirmación │
│ (/resultados)│    │  (/examen)   │    │ (/confirmar) │
│              │    │              │    │              │
│ 4 Tabs:      │    │ - Cronómetro │    │ - Info área  │
│ - Revisión   │    │ - Navegador  │    │ - Instrucciones│
│ - Gráfico    │    │ - 60 preguntas│   │              │
│ - Detalle    │    │              │    │              │
│ - Historial  │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Componentes por Ruta

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/` | Landing | Página de bienvenida con features, stats, áreas |
| `/registro` | StudentForm | Formulario 2 pasos: datos personales + área/carrera |
| `/confirmar` | ExamConfirmation | Confirmación con instrucciones del examen |
| `/examen` | Quiz | Interfaz del examen con cronómetro y navegador |
| `/resultados` | Results | Resultados con 4 tabs: Revisión, Gráfico, Detalle, Historial |

---

## Sistema de Puntuación

### Niveles de Desempeño

| Nivel | Puntaje Mínimo | Porcentaje | Color |
|-------|----------------|------------|-------|
| Excelente | ≥ 2400 pts | 80% | Verde |
| Bueno | ≥ 1800 pts | 60% | Azul |
| Regular | ≥ 1200 pts | 40% | Ámbar |
| Necesita práctica | < 1200 pts | <40% | Rojo |

### Cálculo de Puntaje

1. Cada asignatura tiene un **puntaje máximo** definido en la configuración
2. El puntaje por pregunta = `maxScore / questionCount`
3. Solo las **respuestas correctas** suman puntos
4. **Puntaje total máximo**: 3000 puntos

---

## Sistema de Usuarios y Historial

### Registro de Usuarios

El sistema registra usuarios en la hoja `usuarios` de Google Sheets:

```typescript
interface RegisterData {
  dni: string;           // 8 dígitos
  fullName: string;      // Nombre completo
  email: string;         // Email opcional
  phone: string;         // Celular opcional
  processType: 'CEPREUNA' | 'GENERAL' | 'EXTRAORDINARIO';
  area: 'Ingenierías' | 'Sociales' | 'Biomédicas';
  career: string;        // Carrera profesional
}
```

**Optimización**: Si el DNI ya existe, NO se duplica. Solo actualiza si email, teléfono o carrera cambiaron.

### Historial de Puntajes

Cada vez que un usuario termina un examen, se guarda automáticamente:

```typescript
interface ScoreData {
  dni: string;
  score: number;         // Puntaje obtenido
  maxScore: number;      // Puntaje máximo (3000)
  area: AreaType;
  correct: number;       // Preguntas correctas
  total: number;         // Total de preguntas (60)
}
```

El historial se recupera con `getUserHistory(dni)`:

```typescript
interface UserHistory {
  dni: string;
  totalIntentos: number;
  history: HistoryEntry[];
  mejorPuntaje: number;
  ultimoPuntaje: number;
}

interface HistoryEntry {
  fecha: string;
  area: string;
  puntaje: number;
  puntajeMax: number;
  correctas: number;
  total: number;
  porcentaje: number;
}
```

### Visualización del Historial (Tab en Results)

- **Stats cards**: Total simulacros, Mejor puntaje, vs Anterior (diferencia)
- **LineChart**: Evolución de puntajes (solo si hay 2+ intentos)
- **Tabla**: Lista de todos los intentos con fecha, área, correctas, puntaje
- **Indicadores**: Trofeo en mejor puntaje, "(actual)" en el último

---

## Despliegue

### GitHub Pages (Recomendado)

El proyecto incluye un workflow de GitHub Actions (`.github/workflows/deploy.yml`) para desplegar automáticamente.

1. Habilitar GitHub Pages en Settings > Pages
2. Source: GitHub Actions
3. Cada push a `main` despliega automáticamente

### Variables de Entorno en Producción

En GitHub, configurar secrets:
- `VITE_API_URL`: URL del Google Apps Script
- `VITE_USE_MOCK`: `false`

---

## Desarrollo Local

### Comandos Disponibles

```bash
# Desarrollo con hot reload
npm run dev

# Compilar para producción
npm run build

# Preview de build
npm run preview

# Linting
npm run lint
```

### Modo Mock

Para desarrollo sin backend, asegurarse de tener:
```env
VITE_USE_MOCK=true
```

Esto usa datos generados localmente en `src/services/api.ts`.

---

## Tipos TypeScript Principales

```typescript
// Áreas disponibles
type AreaType = 'Ingenierías' | 'Sociales' | 'Biomédicas';

// Estados del examen
type ExamStatus = 'idle' | 'loading' | 'ready' | 'in_progress' | 'completed' | 'error';

// Tipos de proceso de admisión
type ProcessType = 'CEPREUNA' | 'GENERAL' | 'EXTRAORDINARIO';

// Estructura de una pregunta
interface Question {
  id: string;
  number: number;              // Número global (1-60)
  questionText: string;        // Soporta HTML: <b>, <i>, <u>, <mark>, <br>
  questionType: string;
  options: string[];           // 5 opciones (también soportan HTML)
  correctAnswer: number;       // Índice 0-based
  timeSeconds: number;         // 180 (3 min)
  imageLink: string | null;
  subject: string;
  points: number;
  sourceFile?: string | null;  // "Examen_2024.pdf"
}

// Estudiante registrado
interface Student {
  dni: string;
  fullName: string;
  area: AreaType;
}

// Respuesta del estudiante
interface Answer {
  questionId: string;
  selectedOption: number | null;
  isCorrect: boolean;
  timeSpent: number;
}

// Resultado por asignatura
interface SubjectResult {
  name: string;
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
  pointsObtained: number;
  maxPoints: number;
}

// Historial de usuario
interface UserHistory {
  dni: string;
  totalIntentos: number;
  history: HistoryEntry[];
  mejorPuntaje: number;
  ultimoPuntaje: number;
}
```

---

## Características del Quiz

### Durante el Examen
- **Cronómetro global** estilo Google Forms (borde azul, fondo blanco)
- **Navegador de preguntas** desplegable lateral con colores:
  - Verde: Contestada
  - Gris: Sin contestar
  - Borde azul: Actual
- **Colores Google en opciones**: A=azul, B=rosa, C=ámbar, D=verde, E=púrpura
- **Botones Anterior/Siguiente** para navegar
- **Indicador de progreso** (X / 60)
- **Sin feedback** hasta presionar "Calificar"
- **Botón WhatsApp** para reportar errores

### Al Calificar
- Modal de confirmación
- Advierte si hay preguntas sin contestar
- Muestra tiempo transcurrido
- Opción de ir a pregunta sin contestar

### En Resultados (4 Tabs)
1. **Revisión**: Navegador visual de las 60 preguntas (verde/rojo)
2. **Gráfico**: BarChart de rendimiento por asignatura
3. **Detalle**: Tabla con todas las preguntas y sus respuestas
4. **Historial**: Stats + LineChart + Tabla de intentos anteriores

---

## Formato de Texto en Preguntas

El sistema soporta HTML básico en el texto de preguntas y opciones:

| Tag | Uso | Ejemplo |
|-----|-----|---------|
| `<b>` | Negrita | `El valor de <b>x</b> es...` |
| `<i>` | Cursiva | `Según el <i>teorema</i>...` |
| `<u>` | Subrayado | `Encuentra <u>la respuesta</u>` |
| `<mark>` | Resaltado amarillo | `El resultado es <mark>42</mark>` |
| `<br>` | Salto de línea | `Primera línea<br>Segunda línea` |
| `<sub>` | Subíndice | `H<sub>2</sub>O` |
| `<sup>` | Superíndice | `x<sup>2</sup>` |

---

## Notas Importantes

1. **Orden de preguntas**: Las preguntas se presentan en orden por asignatura según la tabla de configuración (NO aleatorias). Las preguntas dentro de cada asignatura sí son seleccionadas aleatoriamente del banco.

2. **Imágenes**: Se soportan imágenes mediante links en la columna `Image Link` del banco de preguntas.

3. **Tiempo**: El examen no tiene límite de tiempo. El cronómetro solo registra el tiempo transcurrido.

4. **Respuestas**: Las preguntas sin contestar se evalúan como incorrectas.

5. **Base de datos**: Todo el contenido se gestiona desde Google Sheets, facilitando la actualización del banco de preguntas sin tocar código.

6. **Usuarios**: El registro NO duplica usuarios por DNI. Si el mismo DNI vuelve a registrarse, solo actualiza datos si cambiaron.

7. **Historial**: Se guarda automáticamente al finalizar cada examen. Se obtiene con un delay de 500ms después de guardar para asegurar que Google Sheets procesó el registro.

8. **WhatsApp**: Link de contacto para reportar errores: `https://wa.link/40zqta`

---

## API Functions (api.ts)

```typescript
// Configuración de áreas
fetchConfig(): Promise<Config>

// Preguntas del examen
fetchQuestions(area: AreaType): Promise<Question[]>

// Registro de usuario
registerUser(data: RegisterData): Promise<RegisterResponse>

// Guardar puntaje
saveScore(data: ScoreData): Promise<void>

// Obtener historial
getUserHistory(dni: string): Promise<UserHistory | null>
```

---

## Créditos

Desarrollado para la **Universidad Nacional del Altiplano - Puno, Perú**

Plataforma: SimulaUNA v1.1.0

Preguntas reales de exámenes de admisión desde 1993 hasta el último proceso.
