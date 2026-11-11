# DESIGN.md — Plataforma de Simulacros SINAPSIS (v1 · "Terminal de estudio")

> Segunda plataforma de SINAPSIS EDU: donde el alumno **resuelve** (simulacros, banqueo, resultados).
> La primera (sinapsisedu.com) **vende**; esta **se usa todos los días**. Por eso no copia la landing:
> toma la disciplina de una app de trading — **Polymarket** — y la viste con la marca SINAPSIS
> (paleta jungle/lime y tipografías del `DESIGN.md` de SinapsisEdu v3).
>
> Referencia analizada: `polymarket.us/event/btc-updown-15m-…` (11-nov-2026).

---

## 1. Qué tomamos de Polymarket (y por qué funciona)

| Patrón en Polymarket | Por qué funciona | Cómo lo usamos aquí |
|---|---|---|
| **Dos columnas**: contenido a la izquierda (~700 px) + **panel de acción fijo** a la derecha (~290 px) | El ojo lee a la izquierda y decide a la derecha; la acción nunca se pierde al hacer scroll | Enunciado + imagen a la izquierda; **panel de respuesta** (alternativas, confirmar, temporizador, progreso) fijo a la derecha |
| Cabecera de evento: **icono 48 px + migas** (`Bitcoin · Up/Down · 15m · fecha`) + **título condensado en MAYÚSCULAS** | Te ubica en 1 segundo | `ENAM · Simulacro · 180 preguntas · 3 h` + título `PREGUNTA 37 / 180` |
| **Anillo de cuenta regresiva** (`04:08`) que se vacía | Urgencia visible sin alarmar | Temporizador del examen como anillo; cambia a ámbar < 10 min y rojo < 2 min |
| Botones binarios grandes **Up 20 % / Down 81 %** (verde lleno vs. contorno) | Decisión clara, una sola acción por toque | Alternativas A–D como **botones-fila de 48 px**; la elegida se llena de `jungle-800` |
| **"Past" ●●●●●** (historial de resultados en puntos verdes/rojos) | Feedback de racha sin leer números | Tira con las últimas 10 respuestas del banqueo (✔ verde / ✘ rojo / ○ en blanco) |
| Monto grande **$0** + chips **+$5 +$10 +$25** | Selección rápida sin teclear | Banqueo: chips **10 · 20 · 50 · 100 preguntas** y "solo falladas" |
| CTA final **Buy** gris deshabilitado hasta que eliges | Imposible enviar algo vacío | **Confirmar respuesta** deshabilitado hasta marcar una alternativa |
| Pestañas **Trade / Positions** en el panel | Dos modos sin cambiar de página | **Responder / Mi progreso** |
| Acordeones **Market rules · Timeline & Payout (stepper) · FAQ** | Reglas disponibles sin estorbar | **Reglas del examen · Cómo se califica (stepper) · Preguntas frecuentes** |
| Barra de categorías con subrayado (**Sports · Crypto · Politics…**) | Navegación plana entre mercados | **ENCIB · ENAM · Residentado · SERUMS · EsSalud** |
| Números que **ruedan** al cambiar (precio, %) y `tabular-nums` | Se siente vivo y preciso | Nota, % de acierto y contador de preguntas con dígitos tabulares que ruedan |
| Bordes finísimos (navy al ~10 % de opacidad), radios 12–16 px, casi sin sombras | Limpio, "financiero", nada de adornos | Igual, con `line` de la marca |
| Botón **Deposit** azul arriba a la derecha | El dinero siempre a un clic | **Mis accesos / Renovar** (lleva a la pasarela) |
| Footer con aviso legal pequeño | Confianza y cumplimiento | Libro de Reclamaciones, Términos, Privacidad, aviso "material de práctica" |

**Lo que NO copiamos:** el chat público (riesgo de spam y copia de respuestas — en su lugar "N alumnos practicando ahora" **solo si el dato es real**), el lenguaje de apuestas, el azul `Deposit` (usamos nuestra paleta) y la tipografía condensada para todo (solo títulos).

---

## 2. Principios

1. **Una pantalla, una decisión.** En cada momento hay exactamente un botón primario.
2. **La acción está fija; el contenido se mueve.** Panel derecho `sticky` en escritorio; barra inferior fija en móvil.
3. **Números serios.** Todo número (tiempo, nota, %) en `tabular-nums`; nunca saltan de ancho.
4. **El color significa algo.** Verde = correcto, rojo = incorrecto, ámbar = tiempo, jungle = acción. Nada decorativo.
5. **Cero distracción en simulacro.** Sin animaciones, sin chat, sin promociones mientras corre el tiempo.
6. **Feedback inmediato en banqueo**, diferido en simulacro (como el examen real).

---

## 3. Color (hereda SinapsisEdu v3)

```
Marca
  jungle-900  #0B211F   cabecera del aula en modo oscuro, footer
  jungle-800  #10312D   botón primario, alternativa seleccionada, títulos
  jungle-600  #1F5B52   enlaces, hover, foco
  jungle-100  #E3EEEC   chips, fondos suaves, pestaña activa
  lime-400    #C2E476   solo chispa: badge "nuevo récord", anillo del temporizador al inicio

Neutros
  white   #FFFFFF  fondo
  paper   #F6F8F7  fondo de la columna principal en móvil, filas alternas
  line    #E2E8E6  bordes 1 px (equivalente al navy/10 % de Polymarket)
  ink     #0F1A18  texto
  muted   #51625E  metadatos (migas, "Precio a superar" → "Tiempo restante")
  subtle  #8A9A96  placeholders, ejes de gráficos

Estado (solo con significado)
  correct  #16A34A  fondo #DCFCE7   ✔, barra de acierto, "Aprobado"
  wrong    #DC2626  fondo #FEE2E2   ✘, "Desaprobado"
  warning  #D97706  fondo #FEF3C7   temporizador < 10 min, preguntas marcadas para revisar
  info     #2563EB                   enlaces a la justificación
```

Equivalencias Polymarket → SINAPSIS: verde `Up` → `correct`; rojo `Down` → `wrong`; azul `Deposit` → `jungle-800`; borde navy/10 % → `line`.

---

## 4. Tipografía

| Uso | Fuente | Tamaño / peso | Notas |
|---|---|---|---|
| Título de pantalla (`PREGUNTA 37 / 180`, `RESULTADOS ENAM`) | **Plus Jakarta Sans** 800, MAYÚSCULAS, `letter-spacing: .02em` | 28–32 px | Cumple el rol de "Instrument Sans Condensed" de Polymarket sin salir de la marca |
| Enunciado de la pregunta | **Inter** 400 | 17 px / 1.65 | Máx. 68 caracteres por línea |
| Alternativas | Inter 500 | 16 px | Letra A–D en círculo 28 px |
| Números (tiempo, nota, %) | Inter 600 `font-variant-numeric: tabular-nums` | 14–40 px | Nota final 56 px |
| Migas / metadatos | Inter 500 | 13 px, `muted` | Separador `·` |
| Etiquetas de sección | Inter 600, MAYÚSCULAS | 11 px, `.08em` | Como "MARKETS / SUPPORT" del footer |

---

## 5. Layout

```
ESCRITORIO (≥1024 px) — contenedor 1040 px, gutter 32 px
┌──────────────────────────────────────────────────────────────────────┐
│ [logo] SINAPSIS · Simulacros    [buscar tema /]      Mis accesos  (Y)│ 64 px
│ ENCIB  ENAM  Residentado  SERUMS  EsSalud   (subrayado = activo)     │ 44 px
├───────────────────────────────────────────────┬──────────────────────┤
│ [ícono] ENAM · Simulacro · 180 preg · 3 h     │ ┌ Responder│Progreso ┐│
│ PREGUNTA 37 / 180                    [🔖][⤴]  │ │ ◔ 1:24:08          ││ sticky
│ ───────────────────────────────────────────── │ │ (A) ……………………    ││ top: 120
│ Enunciado del caso clínico……                  │ │ (B) ……………………    ││
│ [imagen opcional]                             │ │ (C) ……………………    ││
│                                               │ │ (D) ……………………    ││
│ Últimas: ● ● ✘ ● ○ ● ●       Curso: Pediatría │ │ [ Confirmar ]       ││
│ ───────────────────────────────────────────── │ └─────────────────────┘│
│ ▸ Reglas del examen                           │ ┌ Navegador 1…180 ───┐│
│ ▸ Cómo se califica   ●──○──○                  │ │ ▢▢▢■▢▢▢ (grid)     ││
│ ▸ Preguntas frecuentes                        │ └─────────────────────┘│
└───────────────────────────────────────────────┴──────────────────────┘
   columna principal 1fr (máx. 700)               panel 320 px, gap 32

MÓVIL (<1024 px) — una columna; el panel pasa a barra inferior fija:
  cabecera compacta (examen + ◔ tiempo) → enunciado → alternativas en la página
  → barra fija abajo: [◀]  37/180  [ Confirmar ]  [▶]
```

---

## 6. Componentes

### 6.1 Cabecera de examen (≈ cabecera de mercado)
Ícono del examen 48 px (radio 12, fondo `jungle-100`, pictograma `jungle-800`) · migas 13 px `muted` · título 28–32 px MAYÚSCULAS · acciones a la derecha: **marcar para revisar** y **compartir resultado** (iconos 20 px, botón 36 px, sin borde).

### 6.2 Temporizador anillo (≈ `04:08`)
Pastilla 64×36, radio 999, borde `line`; arco SVG 2 px que se vacía. Colores: `jungle-600` → `warning` (<10 min) → `wrong` (<2 min, pulso suave 1 vez por minuto). Texto `tabular-nums` 14 px. Al llegar a 0: modal "Tiempo agotado" y envío automático.

### 6.3 Alternativas (≈ botones Up/Down)
Fila 48 px mín., radio 12, borde 1 px `line`, padding 12/16. Estados:
- reposo: blanco · hover: `paper` · **seleccionada**: fondo `jungle-800`, texto blanco, círculo de letra en `lime-400`
- banqueo tras confirmar: correcta `correct` lleno; la marcada errónea `wrong` contorno + fondo `#FEE2E2`; resto 50 % opacidad
- teclado: `1–5` o `A–E` eligen, `Enter` confirma, `←/→` navegan (como el atajo `/` del buscador de Polymarket).

### 6.4 Panel de acción (≈ Trade card)
Tarjeta radio 16, borde `line`, sin sombra (sombra solo al hacer scroll: `0 1px 2px rgb(0 0 0 / .04)`). Pestañas `Responder | Mi progreso` 45 px con subrayado 2 px `ink`. Botón primario ancho completo 48 px: deshabilitado `paper`+`subtle`, activo `jungle-800`.

### 6.5 Chips de cantidad (≈ +$5 +$10 +$25)
Altura 32, radio 8, borde `line`, texto 14 px 600. Banqueo: `10 · 20 · 50 · 100` y `Solo falladas`. Seleccionado: `jungle-100` + borde `jungle-600`.

### 6.6 Racha (≈ "Past ●●●●●")
Pastilla `paper` radio 999 con etiqueta "Últimas" y hasta 10 puntos de 16 px: ✔ `correct`, ✘ `wrong`, ○ `subtle`.

### 6.7 Navegador de preguntas
Grid de cuadros 32 px (10 por fila en escritorio): sin responder `white`/`line`, respondida `jungle-100`, marcada `warning` borde, actual `jungle-800`. Contador "142 respondidas · 38 en blanco · 5 marcadas".

### 6.8 Acordeones (≈ Market rules / Timeline & Payout / FAQ)
Fila 56 px, divisor `line`, chevron 16 px. "Cómo se califica" lleva un **stepper** de 3 puntos (Responder → Calificar → Revisar) igual al de *Timeline & Payout*.

### 6.9 Resultados
- Nota grande 56 px `tabular-nums` **X / escala** (20 o 80) + badge Aprobado/Desaprobado si el examen tiene nota mínima.
- Fila de 4 KPIs (Correctas, Incorrectas, En blanco, Tiempo) en tarjetas radio 12.
- **Barras horizontales por curso** ordenadas de peor a mejor (32 filas ENAM caben: 20 px por barra, scroll interno). Verde ≥ 70 %, ámbar 50–69 %, rojo < 50 %.
- Lista de revisión: filtro `Todas · Incorrectas · En blanco · Marcadas`; cada pregunta abre su justificación ("estilo libro" de la landing).
- CTA: **Practicar mis cursos débiles** (crea un banqueo con los 3 peores) · Descargar PDF.

### 6.10 Barra de categorías
Como Polymarket: texto 14 px 500 `muted`, activo `ink` + subrayado 2 px. Un ítem por examen; los no comprados muestran candado 12 px y llevan a la compra en sinapsisedu.com.

---

## 7. Movimiento

- Dígitos que ruedan (nota, %, contador) 300 ms `ease-out`, solo al cambiar.
- Feedback de banqueo: la alternativa correcta hace *fill* de izquierda a derecha 200 ms.
- Panel y acordeones: 150–200 ms. **Durante el simulacro: ninguna otra animación.**
- `prefers-reduced-motion`: todo instantáneo.

## 8. Accesibilidad
Contraste AA (texto `muted` sobre blanco 5.9:1). Alternativas como `role="radiogroup"`. Temporizador con `aria-live="polite"` solo en hitos (10 min, 2 min). Foco visible 2 px `jungle-600`. Objetivos táctiles ≥ 44 px.

## 9. Tokens Tailwind (añadir a `tailwind.config.js`)

```js
theme: {
  extend: {
    colors: {
      jungle: { 900: '#0B211F', 800: '#10312D', 600: '#1F5B52', 100: '#E3EEEC' },
      lime: { 400: '#C2E476' },
      paper: '#F6F8F7', line: '#E2E8E6', ink: '#0F1A18', muted: '#51625E', subtle: '#8A9A96',
      correct: '#16A34A', wrong: '#DC2626', warning: '#D97706',
    },
    fontFamily: { display: ['"Plus Jakarta Sans"', 'sans-serif'], sans: ['Inter', 'sans-serif'] },
    borderRadius: { card: '16px', control: '12px', chip: '8px' },
    maxWidth: { terminal: '1040px' },
  },
}
```

## 10. Plan de migración (desde el diseño actual cian/degradado)

1. Tokens + fuentes (quitar degradados cian, `slate`, sombras grandes).
2. `Quiz.tsx` → layout de dos columnas + panel sticky + barra inferior móvil.
3. `Question.tsx` → alternativas 6.3 + atajos de teclado.
4. Temporizador anillo (6.2) y navegador (6.7).
5. `Results.tsx` → 6.9.
6. Banqueo → chips (6.5) + racha (6.6) + feedback inmediato.
7. Landing de la app → barra de categorías (6.10); el marketing queda en sinapsisedu.com.

## 11. No hacer
Degradados en botones · glassmorphism · más de un botón primario por pantalla · chat público · contadores de "usuarios en vivo" inventados · animaciones durante el simulacro · mostrar la respuesta correcta antes de confirmar · colores verde/rojo para algo que no sea correcto/incorrecto.
