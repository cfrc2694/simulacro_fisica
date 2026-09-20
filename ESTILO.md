# Convenciones de redacción

Reglas para escribir preguntas, pistas y explicaciones en este banco. Si vas a agregar contenido, síguelas: mantienen el banco coherente y hacen que las preguntas se puedan mezclar entre sí sin que se note de dónde salió cada una.

## Idioma y redacción

- Todo en español: enunciados, opciones, pistas, explicaciones e interfaz.
- Redacción propia. Una pregunta no se traduce palabra por palabra desde ninguna fuente: se entiende el concepto que evalúa y se escribe de nuevo, con otra situación, otros datos y otro orden de ideas.
- Registro neutro y directo, sin coloquialismos ni segunda persona del plural. "Una partícula de masa $m$ se suelta desde el reposo", no "suelten la partícula".
- Frases cortas. Primero la situación física, después lo que se pregunta.

## Notación

- La constante de Coulomb se escribe $K_e$. **No se usa $\epsilon_0$** en enunciados, opciones, pistas ni explicaciones. Las equivalencias útiles: $K_e = 1/4\pi\epsilon_0$, la ley de Gauss queda $\oint \vec{E}\cdot d\vec{A} = 4\pi K_e Q_{\text{enc}}$ y el campo en la superficie de un conductor, $E = 4\pi K_e\sigma$.
- Punto decimal, no coma: $0.35$ A.
- Unidades en texto normal y separadas del número: `$8.0\ \Omega$`, `$4.00\times10^{3}$ N/(C·m)`.
- Vectores con `\vec{}`; los símbolos de magnitudes van en cursiva matemática, es decir, dentro de `$...$`.
- Fracciones de opciones con `\dfrac` para que se lean bien; en medio de un párrafo, `\frac` o una división en línea.

## Preguntas

- **Cada pregunta es independiente.** Nada de "en la situación del problema anterior" ni de grupos que comparten un enunciado. Si la fuente era una pregunta con partes (a), (b), (c), se convierte en varias preguntas completas, cada una con todo el contexto que necesita.
- **Siempre cinco opciones y una sola correcta.** Nada de "todas las anteriores" ni de respuestas defendibles a medias.
- Los distractores corresponden a errores reales: olvidar un factor, confundir campo con potencial, perder un signo, usar la fórmula de otra geometría, quedarse a medio camino. Al menos uno debería poder descartarse por unidades o por un caso límite.
- `barajar: true` por defecto. Se pone en `false` cuando el orden importa: opciones que nombran curvas o elementos de una figura, o series ordenadas donde mezclar confunde.
- La explicación resuelve la pregunta, dice por qué fallan al menos dos distractores e incluye una comprobación (unidades, caso límite, simetría) cuando aplique.

## Pistas

- Las pistas son **por tema, no por pregunta**: explican el método general y sirven para varias preguntas. Viven en `data/pistas.json` con una key en kebab-case y un `nodo` de la taxonomía de `data/temas.json`.
- Una pista no resuelve la pregunta ni menciona su respuesta. Da la herramienta: qué integral plantear, qué simetría buscar, qué teorema aplicar.
- Antes de crear una pista nueva, revisa si alguna existente ya cubre el tema.

## Figuras

- Todas las figuras se dibujan en TikZ (`tikz/*.tex`) y se compilan a SVG con `scripts/build_figures.sh`. No se usan capturas ni recortes de otras fuentes.
- El texto dentro de la figura se limita a símbolos ($R$, $Q$, $x$, $P$). Los pies van en `data/figuras.json`, no dibujados en la imagen.
- Una figura puede servir a varias preguntas: se referencia por su id.

## Nombres

- Preguntas: `q001`, `q002`, ... en orden de incorporación.
- Figuras: `fig-` más una descripción corta en español, por ejemplo `fig-anillo-eje`.
- Pistas: kebab-case descriptivo, por ejemplo `potencial-integral`.
