# SimulaENCIB - Simulador del Examen Nacional de Ciencias Básicas

Plataforma web para realizar simulacros del **Examen Nacional de Ciencias Básicas (ENCIB)** organizado por **ASPEFAM** (Asociación Peruana de Facultades de Medicina). Permite a estudiantes de medicina practicar con preguntas tipo ENCIB y recibir retroalimentación detallada de su desempeño.

## Características Principales

### Examen
- **100 preguntas** de los 8 cursos de ciencias básicas
- **3 horas de duración** (igual que el ENCIB oficial)
- **Temporizador con cierre automático** al terminar el tiempo
- **Navegación libre** entre preguntas (avanzar/retroceder)
- **Sin feedback inmediato** - el estudiante no sabe si respondió bien hasta calificar
- **Nota vigesimal (0-20)** idéntica al sistema de calificación oficial
- **Soporte para imágenes** en las preguntas
- **Botón de WhatsApp** para reportar errores

### Tipos de Pregunta
- **70% Casos Clínicos**: Preguntas basadas en situaciones clínicas
- **30% Problemas**: Preguntas tipo problema de aplicación

### Cursos Evaluados (8 cursos, 100 preguntas)

| Curso | Preguntas |
|-------|-----------|
| Anatomía | 16 |
| Fisiología | 16 |
| Patología | 16 |
| Farmacología | 16 |
| Microbiología-Parasitología | 11 |
| Bioquímica | 9 |
| Histología | 9 |
| Embriología | 7 |

### Registro de Usuario
- **DNI** (8 dígitos) - requerido
- **Nombre completo** - requerido
- **Correo electrónico** - requerido
- **Celular** (9 dígitos) - requerido
- **Universidad** - selección de 30+ facultades de medicina ASPEFAM

### Resultados
- **Nota vigesimal (0-20)** con fórmula oficial
- **Gráfico de barras** de rendimiento por curso
- **Navegador visual** de preguntas (verde=correcta, rojo=incorrecta)
- **Revisión detallada** de cada pregunta con la respuesta correcta
- **Generación de PDF** con el reporte completo
- **Historial de intentos** por DNI

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
| Recharts | 2.13.3 | Gráficos |
| jsPDF | 2.5.2 | Generación PDF |
| Lucide React | 0.460.0 | Iconos |

### Backend
| Tecnología | Uso |
|------------|-----|
| Google Sheets | Base de datos (preguntas, usuarios, historial) |
| Google Apps Script | API REST |

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
                            │  - Banco_Anatomía    │
                            │  - Banco_Fisiología  │
                            │  - Banco_Patología   │
                            │  - ... (8 hojas)     │
                            │  - usuarios          │
                            │  - historial_puntajes│
                            └──────────────────────┘
```

### Endpoints de la API

| Endpoint | Descripción |
|----------|-------------|
| `?action=config` | Configuración de cursos y preguntas |
| `?action=questions` | 100 preguntas aleatorias de los 8 cursos |
| `?action=register` | Registrar usuario |
| `?action=saveScore` | Guardar puntaje en historial |
| `?action=getHistory&dni=X` | Historial del usuario |
| `?action=test` | Verificar conexión |

---

## Estructura del Proyecto

```
simulaencib/
├── src/
│   ├── components/
│   │   ├── Landing.tsx        # Página inicio con info ENCIB y video
│   │   ├── StudentForm.tsx    # Formulario de registro
│   │   ├── ExamConfirmation.tsx # Confirmación antes del examen
│   │   ├── Quiz.tsx           # Examen con temporizador 3h
│   │   ├── Question.tsx       # Pregunta individual
│   │   ├── Results.tsx        # Resultados con tabs
│   │   ├── PDFGenerator.tsx   # Generador de PDF
│   │   └── index.ts
│   │
│   ├── hooks/
│   │   ├── useExam.ts         # Store Zustand
│   │   └── useTimer.ts        # Temporizador countdown
│   │
│   ├── services/
│   │   └── api.ts             # Cliente API
│   │
│   ├── types/
│   │   └── index.ts           # Tipos TypeScript + universidades
│   │
│   ├── utils/
│   │   └── calculations.ts    # Cálculos nota vigesimal
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── google-apps-script/
│   └── api.gs                 # Backend (copiar a Apps Script)
│
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions para Pages
│
├── .env.example
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Instalación

### 1. Clonar e instalar dependencias
```bash
git clone https://github.com/TU_USUARIO/simulaencib.git
cd simulaencib
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```

Editar `.env`:
```env
VITE_API_URL=https://script.google.com/macros/s/TU_SCRIPT_ID/exec
VITE_USE_MOCK=false
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

## Configuración del Backend

### Google Sheets

Crear un spreadsheet con las siguientes hojas:

#### Hojas de Banco de Preguntas (8)
- `Banco_Anatomía`
- `Banco_Embriología`
- `Banco_Histología`
- `Banco_Bioquímica`
- `Banco_Fisiología`
- `Banco_Patología`
- `Banco_Farmacología`
- `Banco_Microbiología`

**Columnas requeridas:**
| Question Text | Question Type | Option 1-5 | Correct Answer | Time in seconds | Image Link | NUMERO | TEMA | SUBTEMA | NOMBRE DEL ARCHIVO |

#### Hojas automáticas
- `usuarios` - Registro de estudiantes
- `historial_puntajes` - Historial de intentos

### Google Apps Script

1. Ir a [script.google.com](https://script.google.com)
2. Crear nuevo proyecto
3. Copiar contenido de `google-apps-script/api.gs`
4. Actualizar `SPREADSHEET_ID`
5. Desplegar como aplicación web (acceso: Cualquier persona)
6. Copiar URL generada

---

## Sistema de Puntuación ENCIB

### Nota Vigesimal (0-20)

```
Nota = (Correctas / 100) × 20
```

### Niveles de Desempeño

| Nivel | Correctas | Nota | Color |
|-------|-----------|------|-------|
| Excelente | ≥ 80 | ≥ 16 | Verde |
| Bueno | ≥ 60 | ≥ 12 | Azul |
| Regular | ≥ 50 | ≥ 10 | Ámbar |
| Necesita práctica | < 50 | < 10 | Rojo |

---

## Flujo de la Aplicación

```
Landing → Registro → Confirmación → Examen (3h) → Resultados
   │                                    │              │
   │                                    │              ├── Revisión
   │                                    │              ├── Gráfico
   └── Video ENCIB                      └── Timer      ├── Detalle
       Info ASPEFAM                         auto       └── Historial
```

---

## Despliegue en GitHub Pages

El proyecto incluye GitHub Actions para despliegue automático.

1. Crear repositorio en GitHub
2. Push del código
3. Settings → Pages → Source: GitHub Actions
4. Cada push a `main` despliega automáticamente

**URL:** `https://TU_USUARIO.github.io/simulaencib/`

---

## Universidades Incluidas

### Lima (10)
UNMSM, UPCH, USMP, URP, UNFV, UPC, UCSUR, UPSJB, USIL, UPN

### Norte del Perú (7)
UNT, UPAO, UCV, UNP, UDEP, UNC, UNS

### Sur del Perú (6)
UNSA, UCSM, UNSAAC, UNA (Puno), UPT, UNJBG

### Centro y Oriente (6)
UNSLG, UNCP, UPLA, UNHEVAL, UNSCH, UNAP

---

## Características del Temporizador

- **3 horas** de duración total
- **Cuenta regresiva** visible en todo momento
- **Últimos 15 min**: Borde ámbar (advertencia)
- **Últimos 5 min**: Borde rojo parpadeante
- **Al terminar**: Modal automático → Ver resultados

---

## Comandos Disponibles

```bash
npm run dev      # Desarrollo con hot reload
npm run build    # Compilar para producción
npm run preview  # Preview del build
npm run lint     # Linting
```

---

## Información del ENCIB

El **Examen Nacional de Ciencias Básicas (ENCIB)** es una prueba organizada por **ASPEFAM** (Asociación Peruana de Facultades de Medicina) dirigida a estudiantes de medicina que culminan cursos de Ciencias Básicas.

### Objetivos
- Evaluar suficiencia de conocimientos en ciencias básicas
- Proporcionar información objetiva a las facultades
- Orientar procesos de desarrollo curricular

### Características Oficiales
- 100 preguntas en 3 horas
- 70% casos clínicos, 30% problemas
- 5 alternativas por pregunta
- Sin puntaje negativo
- Nota vigesimal (0-20)

---

## Créditos

Desarrollado para estudiantes de medicina del Perú.

Plataforma: **SimulaENCIB v1.0.0**

Basado en el formato oficial del ENCIB de ASPEFAM.

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
