# Design Brief — Trivia Castro (frontend)

Dirección: **arcade retro**. Debe parecer una máquina arcade hecha a mano, no una plantilla web. Es la misma estética de la presentación de la etapa 2.

## Principios
1. **Juego primero, web después.** Pantalla completa, sin scroll en partida, sin sensación de "página".
2. **Todo se mueve con intención.** Cada cambio de fase tiene entrada y salida; el movimiento comunica (urgencia, acierto, fallo).
3. **Colores saturados sobre fondo oscuro.** Contraste alto, legible en proyector.
4. **Imperfección controlada.** Bordes gruesos, sombras duras desplazadas, pixel-art; evitar degradados suaves, glassmorphism, tarjetas redondeadas "SaaS".
5. **Feedback inmediato.** Cada toque da respuesta visual (y opcionalmente sonido) en < 100 ms.

## Tokens (arrancar con esto y afinar)
```css
:root {
  --bg: #0d0b1f;          /* fondo noche */
  --bg-2: #17133a;        /* paneles */
  --ink: #f5f1e6;         /* texto */
  --ink-dim: #9d98c7;
  --magenta: #ff2e93;     /* acción principal */
  --cyan: #19e3ff;        /* información / timer */
  --yellow: #ffd23f;      /* puntos / poderes */
  --green: #3dff8b;       /* correcto */
  --red: #ff4d4d;         /* fallo / vidas */
  --violet: #7a5cff;
  --border: 4px;
  --shadow-hard: 6px 6px 0 #000;   /* sombra dura, sin blur */
  --font-title: "Press Start 2P", monospace;
  --font-body: "JetBrains Mono", monospace;
}
```
- Cada opción de respuesta tiene su color fijo (A magenta, B cyan, C yellow, D violet) **más un símbolo** (▲ ● ■ ◆) para no depender solo del color.
- Rojo reservado a pérdida de vida / fallo. Verde reservado a "correcto".

## Tipografía
- Títulos, números grandes, botones: **Press Start 2P** (pocas palabras; tamaños múltiplos de 8).
- Texto de pregunta y datos: **JetBrains Mono** (peso 700 para preguntas). La pregunta nunca va en Press Start (ilegible en frases largas).
- Texto de pregunta: tamaño responsive `clamp(22px, 3.2vw, 44px)`.

## Componentes base
- **PixelButton**: borde 4 px negro, sombra dura; hover sube 2 px; active "se hunde" (sombra 0).
- **Panel**: fondo `--bg-2`, borde grueso, esquinas rectas (o con muesca pixelada).
- **LifeHearts**: corazones pixel; al perder uno, se rompe (shake + partículas + fade).
- **Timer**: barra segmentada por bloques + número grande; cambia a rojo y parpadea en los últimos 5 s.
- **ScoreTally**: conteo de puntos tipo contador de arcade (los dígitos "ruedan"), desglose base + velocidad + ronda + poder.
- **PlayerChip**: nickname, puntos, vidas, check de "ya respondió".
- **PowerSlot**: ícono del poder (DOUBLE ×2, SHIELD 🛡, HINT 💡 dibujados en pixel art), estado disponible / activo / usado.
- **RoomCode**: código de 6 caracteres en bloques grandes, botón copiar, QR opcional.
- **Fondo animado**: rejilla estilo synthwave en perspectiva + estrellas, con parallax suave; baja intensidad en pantallas de lectura (pregunta).
- Efecto **CRT** opcional (scanlines + leve viñeta) activable; desactivado con `prefers-reduced-motion`.

## Lenguaje de movimiento
| Momento | Animación |
|---|---|
| Entrada a pantalla | Slide + "glitch" corto (120–180 ms), nunca fade genérico |
| Cambio de fase | Transición de pantalla tipo "cortinilla" pixelada (barrido de bloques) |
| ROUND_INTRO | Número de ronda cae con rebote; si es DOUBLE, banner "x2" con destello y sacudida |
| QUESTION | Opciones entran escalonadas (40 ms entre cada una); timer arranca con "tick" |
| Elegir respuesta | La opción "se presiona", las demás se atenúan; check de "enviado" |
| Últimos 5 s | Timer pulsa y vibra levemente; borde de pantalla en rojo |
| REVEAL | Se neutralizan las opciones → la correcta se ilumina en verde con pulso; la incorrecta elegida tiembla en rojo |
| Puntos | ScoreTally: +base, +velocidad, ×ronda, ×poder, total (cada paso con su "ding") |
| Perder vida | Corazón se rompe, flash rojo breve, shake de pantalla (suave) |
| SCOREBOARD | Filas se reordenan con animación de posición (`layout` de motion), flechas ▲▼ según `positionDelta` |
| SPECTATOR | Overlay "ESPECTADOR" con filtro gris/escala de grises parcial; sigue viendo todo |
| FINAL | Podio que se construye por bloques 3º → 2º → 1º, confeti en el ganador, luego stats |

Duraciones: micro 100–200 ms, transiciones 300–500 ms, momentos clave 600–1200 ms. Las animaciones **nunca bloquean** el cambio de fase del servidor: si llega una fase nueva a mitad de animación, se cierra rápido (skip) y se pasa a la nueva.

## Sonido (opcional, pero suma mucho)
Bleeps con WebAudio: click, tick del timer, correcto, incorrecto, pérdida de vida, power-up, fanfarria final. Botón de mute visible y persistente (localStorage con try/catch). Sin autoplay antes del primer gesto del usuario.

## Responsive
- **Móvil vertical** (jugadores): una columna, respuestas grandes (mínimo 64 px alto).
- **Escritorio/proyector** (host, scoreboard, final): layouts amplios, tipografía más grande.
- Probar a 360×640, 768×1024, 1280×720 y 1920×1080.

## Accesibilidad
Foco visible, contraste AA, `aria-live="polite"` en cambios de fase y resultados, símbolos junto a color, versión sobria con `prefers-reduced-motion`.

## Lo que NO debe pasar (para que no parezca hecho por IA genérica)
- Tarjetas blancas redondeadas con sombra suave.
- Degradados morado→azul de fondo tipo landing SaaS.
- Íconos de librería genérica (usar pixel art propio o glifos de bloque).
- Emojis como decoración principal.
- Layout centrado y simétrico en todo; romper con ángulos, banners inclinados (–2°), stickers.
- Animaciones "fade-up" idénticas en todos lados.
