#!/usr/bin/env bash
# Compila cada figura TikZ de tikz/*.tex a figures/<nombre>.svg
# Requiere pdflatex (texlive con tikz y circuitikz) y pdftocairo (poppler-utils).
# Uso:  bash scripts/build_figures.sh                 (todas)
#       bash scripts/build_figures.sh fig-anillo-eje  (una sola)
set -e
cd "$(dirname "$0")/.."
mkdir -p figures
tmp=$(mktemp -d)
objetivo=${1:-}
for tex in tikz/*.tex; do
  nombre=$(basename "$tex" .tex)
  [ "$nombre" = "preambulo" ] && continue
  if [ -n "$objetivo" ] && [ "$nombre" != "$objetivo" ]; then continue; fi
  echo "-> $nombre"
  (cd tikz && pdflatex -interaction=batchmode -halt-on-error -output-directory "$tmp" "$nombre.tex" >/dev/null)
  pdftocairo -svg "$tmp/$nombre.pdf" "figures/$nombre.svg"
done
rm -rf "$tmp"
echo "Listo. SVG en figures/"
