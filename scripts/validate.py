#!/usr/bin/env python3
"""Revisa la consistencia de data/*.json, de las figuras y de las convenciones de estilo.

Uso:  python3 scripts/validate.py
Devuelve 1 si hay errores (sirve para CI o antes de hacer commit).
"""
import json, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
cargar = lambda n: json.loads((RAIZ / "data" / f"{n}.json").read_text(encoding="utf-8"))

preguntas, pistas, temas, figuras = (cargar(n) for n in ("preguntas", "pistas", "temas", "figuras"))
errores, avisos = [], []
err, avi = errores.append, avisos.append

DIFICULTADES = {"facil", "media", "dificil"}
ORIGENES = {"adaptada", "propia", "ia"}
CAMPOS = ["id", "origen", "revisada", "tema", "subtemas", "dificultad", "figuras",
          "enunciado", "opciones", "respuesta", "respuesta_verificada", "barajar",
          "pistas", "explicacion"]

def revisar_latex(texto, donde):
    if texto.count("$") % 2:
        err(f"{donde}: número impar de '$' (LaTeX sin cerrar)")
    # Convención del proyecto: se usa K_e, no epsilon_0 (ver ESTILO.md)
    if re.search(r"\\epsilon_?0|\\varepsilon_?0", texto):
        avi(f"{donde}: usa epsilon_0; la convención del proyecto es K_e")

ids = [p.get("id") for p in preguntas]
for dup in {i for i in ids if ids.count(i) > 1}:
    err(f"id de pregunta duplicado: {dup}")

pistas_usadas, figuras_usadas = set(), set()
for p in preguntas:
    pid = p.get("id", "?")
    for c in CAMPOS:
        if c not in p:
            err(f"{pid}: falta el campo '{c}'")
    if not re.fullmatch(r"q\d{3,}", str(pid)):
        avi(f"{pid}: el id no sigue el formato qNNN")
    if p.get("origen") not in ORIGENES:
        err(f"{pid}: 'origen' debe ser uno de {sorted(ORIGENES)}")
    if p.get("dificultad") not in DIFICULTADES:
        err(f"{pid}: 'dificultad' debe ser una de {sorted(DIFICULTADES)}")
    ops = p.get("opciones", [])
    if len(ops) != 5:
        err(f"{pid}: tiene {len(ops)} opciones; todas las preguntas llevan 5")
    if len(set(ops)) != len(ops):
        err(f"{pid}: hay opciones repetidas")
    if not isinstance(p.get("respuesta"), int) or not 0 <= p.get("respuesta", -1) < len(ops):
        err(f"{pid}: 'respuesta' debe ser un índice 0..{len(ops)-1}")
    if not isinstance(p.get("barajar"), bool):
        err(f"{pid}: 'barajar' debe ser true/false")
    if not p.get("explicacion"):
        err(f"{pid}: falta la explicación")
    if p.get("respuesta_verificada") is not True:
        avi(f"{pid}: respuesta sin verificar")
    if p.get("revisada") is not True:
        avi(f"{pid}: sin revisión humana")
    if p.get("tema") not in temas:
        err(f"{pid}: el tema '{p.get('tema')}' no existe en temas.json")
    for s in p.get("subtemas", []):
        if s not in temas:
            err(f"{pid}: el subtema '{s}' no existe en temas.json")
    if not p.get("pistas"):
        avi(f"{pid}: no tiene pistas asignadas")
    for k in p.get("pistas", []):
        pistas_usadas.add(k)
        if k not in pistas:
            err(f"{pid}: la pista '{k}' no existe en pistas.json")
    for f in p.get("figuras", []):
        figuras_usadas.add(f)
        if f not in figuras:
            err(f"{pid}: la figura '{f}' no existe en figuras.json")
    revisar_latex(p.get("enunciado", ""), f"{pid}.enunciado")
    revisar_latex(p.get("explicacion") or "", f"{pid}.explicacion")
    for i, o in enumerate(ops):
        revisar_latex(o, f"{pid}.opciones[{i}]")

for k, h in pistas.items():
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", k):
        avi(f"pista '{k}': la key debería ir en kebab-case")
    for campo in ("nodo", "titulo", "texto"):
        if not h.get(campo):
            err(f"pista '{k}': falta '{campo}'")
    if h.get("nodo") and h["nodo"] not in temas:
        err(f"pista '{k}': el nodo '{h['nodo']}' no existe en temas.json")
    revisar_latex(h.get("texto", ""), f"pista {k}")
    if k not in pistas_usadas:
        avi(f"pista '{k}' no la usa ninguna pregunta")

for t, info in temas.items():
    padre = info.get("padre")
    if padre and padre not in temas:
        err(f"tema '{t}': su padre '{padre}' no existe")

for f, info in figuras.items():
    archivo = RAIZ / info.get("archivo", "")
    if not archivo.is_file():
        err(f"figura '{f}': no existe el archivo {info.get('archivo')}")
    fuente = info.get("fuente")
    if not fuente:
        err(f"figura '{f}': falta la fuente TikZ ('fuente')")
    elif not (RAIZ / fuente).is_file():
        err(f"figura '{f}': no existe la fuente {fuente}")
    if not info.get("alt"):
        err(f"figura '{f}': falta el texto alternativo 'alt'")
    if f not in figuras_usadas:
        avi(f"figura '{f}' no la usa ninguna pregunta")

en_disco = {p.relative_to(RAIZ).as_posix() for p in (RAIZ / "figures").glob("*") if p.is_file()}
for huerfano in sorted(en_disco - {i.get("archivo") for i in figuras.values()}):
    avi(f"archivo sin registrar en figuras.json: {huerfano}")

por_dificultad = {d: sum(1 for p in preguntas if p.get("dificultad") == d) for d in sorted(DIFICULTADES)}
for a in avisos: print("AVISO ", a)
for e in errores: print("ERROR ", e)
print(f"\n{len(preguntas)} preguntas {por_dificultad}, {len(pistas)} pistas, "
      f"{len(figuras)} figuras, {len(temas)} nodos de tema.")
print(f"{len(errores)} errores, {len(avisos)} avisos.")
sys.exit(1 if errores else 0)
