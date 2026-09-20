#!/usr/bin/env python3
"""Actualiza el parámetro ?v= de index.html con un hash del contenido actual
de app.js, styles.css y data/*.json, para forzar que el navegador los vuelva
a pedir cuando cambian (evita tener que hacer Ctrl+Shift+R).

Uso:  python3 scripts/bump_cache.py
Corre esto después de tocar app.js, styles.css o cualquier data/*.json,
antes de subir los cambios.
"""
import hashlib
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INDEX = RAIZ / "index.html"

ARCHIVOS = [RAIZ / "app.js", RAIZ / "styles.css", *sorted((RAIZ / "data").glob("*.json"))]


def calcular_version():
    h = hashlib.sha256()
    for f in ARCHIVOS:
        h.update(f.read_bytes())
    return h.hexdigest()[:12]


def main():
    version = calcular_version()
    html = INDEX.read_text(encoding="utf-8")

    nuevo, n1 = re.subn(r'(styles\.css\?v=)[0-9a-f]+', r"\g<1>" + version, html)
    nuevo, n2 = re.subn(r'(app\.js\?v=)[0-9a-f]+', r"\g<1>" + version, nuevo)
    nuevo, n3 = re.subn(r'(window\.__CACHEBUST__\s*=\s*")[0-9a-f]+(")', r"\g<1>" + version + r"\g<2>", nuevo)

    if not (n1 and n2 and n3):
        print("No se encontraron los tres marcadores esperados en index.html", file=sys.stderr)
        return 1

    if nuevo == html:
        print(f"Ya estaba al día (versión {version}).")
        return 0

    INDEX.write_text(nuevo, encoding="utf-8")
    print(f"index.html actualizado a la versión {version}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
