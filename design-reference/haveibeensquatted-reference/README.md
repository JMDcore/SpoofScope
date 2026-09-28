# Referencia de diseño: Have I Been Squatted

Paquete capturado el **28 de septiembre de 2026** desde [haveibeensquatted.com](https://haveibeensquatted.com/). Está pensado para adjuntarlo a una IA de programación junto con tu brief, de modo que pueda reproducir con mucha fidelidad el lenguaje visual, la composición, el responsive y las interacciones de la referencia.

## Qué contiene

- `screenshots/desktop-1440-full.png`: página completa a 1440 × 900 de viewport (imagen final: 1425 × 5993 px).
- `screenshots/mobile-390-full.png`: página completa a 390 × 844 de viewport (imagen final: 375 × 10233 px).
- `source/original-index.html`: HTML original entregado por el servidor.
- `source/rendered-page.html`: DOM ya hidratado/renderizado en el navegador.
- `assets/`: hojas de estilo, tipografías, imágenes e iconos observados en la página.
- `assets/manifest.json`: URL original y nombre local de cada activo descargado, además de los fallos de descarga.
- `assets/inline-svg/`: 97 SVG incrustados extraídos del DOM.
- `design-data.json`: estilos calculados, variables CSS, tipografías, colores y muestras de componentes.
- `PROMPT-PARA-IA.md`: prompt listo para copiar y pegar en otra IA.

## Cómo usarlo con una IA

1. Adjunta `haveibeensquatted-reference.zip` completo. Si el servicio no admite ZIP, adjunta primero las dos capturas, este README y `PROMPT-PARA-IA.md`.
2. Añade tu contenido real: nombre de marca, objetivo, secciones, textos, CTA y tecnología deseada.
3. Pide primero la página completa y después una ronda de comparación visual contra las capturas en 1440 px y 390 px.
4. Si la IA puede leer archivos, indícale que use `design-data.json` y las CSS de `assets/` para los valores exactos, no solo para “inspirarse”.

## ADN visual que se debe conservar

### Paleta

| Uso | Valor aproximado/exacto |
| --- | --- |
| Fondo principal | `#0A0A0A` (`neutral-950`) |
| Superficies muy oscuras | `#000000` y `#171717` |
| Líneas y cuadrícula | `#262626`, normalmente 1 px |
| Texto principal | `#F5F5F5` |
| Texto secundario | `#A1A1A1` |
| Texto apagado | `#737373` / `#525252` |
| Acento verde lima | `#9DE500` (`lime-400`) |
| Acento rojo puntual | `#FB2C36` |

El verde lima se reserva para palabras clave, estados, cifras, botones principales y bloques CTA. El resto de la interfaz es casi totalmente monocromo.

### Tipografía

- Sans principal: **Inter**, pesos 400–600.
- Mono/técnica: **Berkeley Mono Variable** para microcopy, métricas, etiquetas, datos y elementos tipo terminal.
- H1 de escritorio: alrededor de `60px / 60px`, peso 400.
- H2 de escritorio: alrededor de `40px / 50px`, peso 600, tracking `-1px`.
- Etiquetas de sección: 10–12 px, mono, mayúsculas y tracking amplio.
- Si no existe licencia para Berkeley Mono, usar una alternativa como IBM Plex Mono o Geist Mono.

### Geometría y espaciado

- Sin redondeos: la variable global de radio es `0`.
- Composición técnica mediante rejillas, bordes finos y celdas rectangulares.
- Contenedor central amplio, aproximadamente `max-width: 1280px`.
- Mucho aire vertical, pero poco ornamento: la estructura la crean las líneas y el contraste.
- Desktop usa matrices de 3–4 columnas; mobile las convierte en una sola columna, conservando todas las líneas y jerarquía.

### Estructura de la landing

1. **Navegación mínima**: logotipo a la izquierda, menús discretos al centro y dos acciones a la derecha.
2. **Hero técnico**: fondo de cuadrícula animada, wordmark grande, claim breve, buscador/CTA horizontal, ejemplos rápidos y gran mockup de producto.
3. **Franja de confianza**: logotipos en carrusel horizontal monocromo.
4. **Introducción de funciones**: encabezado grande con una palabra verde, copy en dos columnas y CTA.
5. **Diagrama de flujo**: varias fuentes convergen en el producto y salen convertidas en alertas/resultados.
6. **Proceso en tres pasos**: Detect / Investigate / Disrupt sobre una franja verde intensa.
7. **Integración**: bloque dividido en dos columnas con tono técnico y sobrio.
8. **Matriz de plataforma**: grid modular de tarjetas con microinteracciones, mini dashboards, terminales, gráficos y datos.
9. **Prueba social**: mosaico de testimonios, un testimonio destacado en verde y fila de métricas.
10. **Bloque “por qué”**: texto principal a la izquierda y tres argumentos apilados a la derecha.
11. **CTA final**: mitad verde con copy y botón negro; mitad negra con una visualización tipo consola/score.
12. **Footer denso**: marca, redes, sellos y varias columnas de enlaces.

### Movimiento e interacción

- Menús desplegables en navegación.
- Carrusel/marquee suave de logotipos.
- Gráficos, líneas y números con animación sutil; nada elástico ni juguetón.
- Hover de enlaces y botones hacia verde lima.
- Pequeños indicadores rojos/verdes, cursores, barras y estados para dar sensación de producto vivo.
- En móvil se prioriza la lectura vertical; no se elimina contenido esencial.

## Qué debe cambiar en el nuevo sitio

La referencia sirve para clonar **sistema visual, composición, ritmo, responsive y estilo de interacción**. Sustituye logotipo, textos, datos, testimonios, capturas de producto, iconos de marca y cualquier otro elemento identificativo por los tuyos. Esto evita que el resultado parezca una falsificación de la empresa original y deja una base visual reutilizable.

## Limitaciones de la captura

- Algunos favicons externos de Google no se descargaron por restricciones del origen; aparecen registrados como fallos en `assets/manifest.json` y no afectan al diseño principal.
- El HTML original pertenece a una aplicación Next.js y referencia JavaScript compilado del sitio. El paquete no pretende ser una copia ejecutable del producto, sino una referencia visual/técnica completa para reconstruirlo limpiamente.
- Las tipografías y otros activos pueden tener licencias propias. Verifica permisos antes de reutilizarlos en producción.
