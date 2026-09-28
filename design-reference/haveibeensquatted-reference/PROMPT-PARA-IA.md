# Prompt para construir mi página a partir de esta referencia

Quiero que construyas una landing page nueva para **[NOMBRE DE MI PROYECTO]** usando como referencia visual principal el paquete adjunto de `haveibeensquatted.com`.

El objetivo es conseguir una fidelidad de diseño muy alta: replica la composición general, el ritmo vertical, la rejilla técnica, el contraste negro/verde lima, las proporciones, la jerarquía tipográfica, la densidad de las tarjetas, el responsive y el carácter de las microinteracciones. No quiero una reinterpretación genérica de “cybersecurity”; quiero que el resultado se compare visualmente con `screenshots/desktop-1440-full.png` y `screenshots/mobile-390-full.png` y conserve claramente el mismo lenguaje de diseño.

Usa estos archivos como fuente de verdad:

- `screenshots/desktop-1440-full.png` y `screenshots/mobile-390-full.png` para composición y responsive.
- `README.md` para la anatomía de la página y las reglas visuales.
- `design-data.json` y las CSS en `assets/` para colores, tipografías, tamaños, bordes y espaciado.
- `source/rendered-page.html` para comprender la jerarquía de componentes.
- `assets/manifest.json` para identificar los activos, sin asumir que todos se deben reutilizar.

Requisitos visuales obligatorios:

- Fondo base `#0A0A0A`, superficies negras, bordes de 1 px `#262626` y sin border-radius.
- Acento principal verde lima `#9DE500`; texto principal `#F5F5F5`; grises `#A1A1A1`, `#737373` y `#525252`.
- Inter para titulares y cuerpo; una mono técnica para etiquetas, métricas y elementos de consola.
- Contenedor ancho de unos 1280 px en desktop, grids rectangulares y responsive de una columna en móvil.
- H1 grande y sobrio; H2 alrededor de 40 px en desktop; etiquetas pequeñas en mayúsculas y monoespaciadas.
- Hero con fondo de cuadrícula, claim, input/CTA y un mockup grande de producto.
- Franja de logos, bloque de funciones, proceso en tres pasos, matriz de capacidades, testimonios, métricas, bloque de argumentos, CTA final bicolor y footer de varias columnas.
- Animaciones discretas: marquee, líneas/datos en movimiento, hover verde y transiciones cortas. Respeta `prefers-reduced-motion`.
- Mobile no debe ser una versión recortada: apila las celdas, conserva la jerarquía y evita scroll horizontal accidental.

Contenido de mi proyecto:

- Marca: **[NOMBRE]**
- Qué hace: **[DESCRIPCIÓN EN UNA FRASE]**
- Audiencia: **[AUDIENCIA]**
- CTA principal: **[CTA]**
- Secciones/capacidades: **[LISTA]**
- Testimonios o métricas: **[DATOS]**
- Stack requerido: **[POR EJEMPLO: Next.js + Tailwind + TypeScript]**

No copies la marca “Have I Been Squatted”, sus textos, testimonios, logotipos ni capturas propietarias. Sustitúyelos por el contenido anterior, pero mantén la fidelidad del sistema visual y de la estructura. Implementa componentes reutilizables y accesibles, estados hover/focus claros, HTML semántico y buen contraste.

Antes de dar por terminado el trabajo:

1. Ejecuta la página y toma capturas de página completa a 1440 × 900 y 390 × 844.
2. Compáralas lado a lado con las referencias.
3. Corrige diferencias de ancho de contenedor, alturas, tipografía, espaciado, alineación, bordes, orden responsive y densidad visual.
4. Verifica que no haya overflow horizontal ni errores de consola.

Entrega el código completo y una breve lista de las decisiones en las que mantuviste la referencia y de los elementos de identidad que sustituiste.
