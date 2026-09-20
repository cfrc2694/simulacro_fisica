# Simulacro de Física

Aplicación web para practicar física con ensayos: toma preguntas al azar del banco, permite elegir tema y nivel de dificultad, ofrece una pista por tema con costo en el puntaje y al final entrega un reporte con aciertos, errores y explicaciones.

## Cómo correr

La app es estática: HTML, CSS y JavaScript, sin compilación.

```bash
python3 -m http.server        # abrir http://localhost:8000
python3 scripts/validate.py   # revisar los datos
bash scripts/build_figures.sh # recompilar las figuras TikZ a SVG
python3 scripts/bump_cache.py # actualizar el ?v= de index.html tras tocar app.js, styles.css, data/ o figures/
python3 scripts/build.py      # opcional: dist/index.html en un solo archivo
```

Abrir `index.html` con doble clic no funciona, porque el navegador bloquea la lectura de los JSON desde `file://`. Para eso está `scripts/build.py`.

## Publicar en GitHub Pages

En Settings → Pages, elegir la rama y la carpeta raíz ("Deploy from a branch"). El repositorio ya trae `.nojekyll`, así que los archivos se sirven tal cual. Al ser un sitio estático, `fetch` de los JSON funciona sin configuración.

`index.html` carga `app.js`, `styles.css`, los JSON de `data/` y las figuras de `figures/` con un parámetro `?v=<hash>`. Ese hash lo pone `scripts/bump_cache.py`: corre ese script después de tocar `app.js`, `styles.css`, cualquier `data/*.json` o `figures/*.svg`, antes de subir los cambios, para que el navegador no sirva una copia vieja cacheada.

## Estructura

```
index.html   styles.css   app.js
data/        preguntas, pistas, temas y figuras (JSON)
figures/     figuras en SVG, generadas desde tikz/
tikz/        fuentes TikZ de cada figura
scripts/     validate.py, build.py, build_figures.sh
```

Las convenciones para escribir preguntas, pistas y figuras están en [ESTILO.md](ESTILO.md).

## Aviso

El contenido es material de práctica escrito para este proyecto, en parte con ayuda de modelos de lenguaje, y puede contener errores. Se ofrece como está, sin garantía de exactitud: no lo tomes como la única fuente para estudiar ni para calificar. Si encuentras un error, corrígelo en `data/preguntas.json`.

Las figuras son propias, hechas en TikZ. El repositorio no incluye escaneos, enunciados ni figuras copiados de libros o exámenes publicados por terceros.
