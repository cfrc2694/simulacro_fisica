#!/usr/bin/env python3
"""Genera dist/index.html: la app completa en un solo archivo.

No hace falta para publicar en GitHub Pages (allí basta con el repositorio tal
cual). Sirve para abrir la app con doble clic o para compartirla como un archivo.

Uso:  python3 scripts/build.py
"""
import base64, json, subprocess, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
leer = lambda p: (RAIZ / p).read_text(encoding="utf-8")

if subprocess.run([sys.executable, str(RAIZ / "scripts" / "validate.py")]).returncode:
    sys.exit("Build cancelado: corrige los errores de validación.")

datos = {n: json.loads(leer(f"data/{n}.json")) for n in ("preguntas", "pistas", "temas", "figuras")}
for fig in datos["figuras"].values():
    bruto = (RAIZ / fig["archivo"]).read_bytes()
    fig["src"] = "data:image/svg+xml;base64," + base64.b64encode(bruto).decode()

carga = json.dumps(datos, ensure_ascii=False).replace("</", "<\\/")
html = leer("index.html")
html = html.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + leer("styles.css") + "</style>")
html = html.replace("<!-- DATOS -->", f"<script>window.__DATOS__ = {carga};</script>")
html = html.replace('<script src="app.js"></script>', "<script>\n" + leer("app.js") + "</script>")

salida = RAIZ / "dist" / "index.html"
salida.parent.mkdir(exist_ok=True)
salida.write_text(html, encoding="utf-8")
print(f"Generado {salida.relative_to(RAIZ)} ({salida.stat().st_size/1024:.0f} KB)")
