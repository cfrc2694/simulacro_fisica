/* ============================================================
   Simulacro de Física — lógica de la aplicación
   Los datos viven en data/*.json y se cargan con fetch.
   Si existe window.__DATOS__ (archivo único generado por
   scripts/build.py) se usan esos datos y no se hace fetch.
   ============================================================ */

const TAMANO_ENSAYO = 30;          // preguntas por ensayo
const VALOR_CON_PISTA = 0.5;       // cuánto vale un acierto después de ver la pista
const SEGUNDOS_POR_PREGUNTA = 100; // ritmo de referencia que muestra el cronómetro
const MEZCLA_ESTANDAR = { facil: 0.30, media: 0.45, dificil: 0.25 };
const DIFICULTADES = { facil: "Fácil", media: "Media", dificil: "Difícil" };

let FIGURAS = {}, TEMAS = {}, PISTAS = {}, PREGUNTAS = [];

async function cargarDatos(){
  if(window.__DATOS__){
    ({ figuras: FIGURAS, temas: TEMAS, pistas: PISTAS, preguntas: PREGUNTAS } = window.__DATOS__);
    return;
  }
  const traer = async f => { const r = await fetch(conVersion(f)); if(!r.ok) throw new Error(f + ": " + r.status); return r.json(); };
  [FIGURAS, TEMAS, PISTAS, PREGUNTAS] = await Promise.all(
    ["data/figuras.json","data/temas.json","data/pistas.json","data/preguntas.json"].map(traer));
}

/* ---------------------- utilidades ---------------------- */
const $app = document.getElementById("app");
// scripts/bump_cache.py fija window.__CACHEBUST__ en index.html con un hash del
// contenido de app.js, styles.css, data/*.json y figures/*.svg; así cada versión
// publicada obliga a recargar esos archivos en vez de servir una copia vieja del caché.
const conVersion = ruta => window.__CACHEBUST__ ? (ruta + "?v=" + encodeURIComponent(window.__CACHEBUST__)) : ruta;
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const mezclar = arr => { const a = arr.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); };
const fmtPts = n => Number.isInteger(n) ? String(n) : n.toFixed(1);
const tituloTema = id => (TEMAS[id] && TEMAS[id].titulo) || id;

function rutaTema(id){
  const partes = [];
  let actual = id;
  while(actual && TEMAS[actual]){ partes.unshift(TEMAS[actual].titulo); actual = TEMAS[actual].padre; }
  return partes.join(" › ") || id;
}

function typeset(el){
  const mj = window.MathJax;
  if(mj && mj.startup && mj.startup.promise) mj.startup.promise.then(() => mj.typesetPromise([el])).catch(() => {});
}

function figurasHTML(ids){
  if(!ids || !ids.length) return "";
  return '<div class="figs">' + ids.map(id => {
    const f = FIGURAS[id];
    if(!f) return "";
    const img = `<img src="${f.src || conVersion(f.archivo)}" width="${f.ancho}" alt="${esc(f.alt)}">`;
    return f.pie ? `<figure>${img}<figcaption>${esc(f.pie)}</figcaption></figure>` : img;
  }).join("") + "</div>";
}

/* Pistas: viven en su propia tabla y las preguntas las traen por key */
const pistasDe = p => (p.pistas || []).map(k => PISTAS[k]).filter(Boolean);
const pistasEntradasHTML = (p, clase) => pistasDe(p)
  .map(h => `<div class="${clase}"><b>Pista: ${esc(h.titulo)}</b>${h.texto}</div>`).join("");

function pistaHTML(item){
  const hs = pistasDe(item.p);
  if(!hs.length) return "";
  if(item.pista) return `<aside class="cajapista" tabindex="-1">${pistasEntradasHTML(item.p, "pista")}</aside>`;
  return `<div class="pistacta"><button class="btn btnpista" id="btnpista">Ver pista${hs.length>1?"s":""} del tema</button>
    <span class="nota">Si aciertas después de verla, esta pregunta vale ${fmtPts(VALOR_CON_PISTA)} en vez de 1.</span></div>`;
}

/* -------------------- armado del ensayo -------------------- */
function seccionesDisponibles(){
  const ids = [...new Set(PREGUNTAS.map(p => p.tema))];
  return ids.sort().map(id => ({ id, titulo: tituloTema(id), n: PREGUNTAS.filter(p => p.tema === id).length }));
}

function disponibles(tema){
  return tema === "todos" ? PREGUNTAS : PREGUNTAS.filter(p => p.tema === tema);
}

/* Elige de un solo grupo (pool ya filtrado) respetando la mezcla de dificultad.
   Devuelve también lo que no se usó, para poder rellenar cuotas de otros grupos. */
function elegirDeGrupo(pool, modo, n){
  if(modo !== "estandar"){
    const filtrado = mezclar(pool.filter(p => p.dificultad === modo));
    return { elegidas: filtrado.slice(0, n), resto: filtrado.slice(n) };
  }
  const porNivel = {};
  Object.keys(MEZCLA_ESTANDAR).forEach(d => porNivel[d] = mezclar(pool.filter(p => p.dificultad === d)));
  const elegidas = [];
  Object.entries(MEZCLA_ESTANDAR).forEach(([d, frac]) => {
    elegidas.push(...porNivel[d].splice(0, Math.round(n * frac)));
  });
  const resto = mezclar([].concat(...Object.values(porNivel)));
  while(elegidas.length < n && resto.length) elegidas.push(resto.shift());
  return { elegidas, resto };
}

/* Reparte n cupos entre k grupos lo más parejo posible (diferencia máxima de 1). */
function repartirCuota(n, k){
  const base = Math.floor(n / k), extra = n - base * k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

function elegirPreguntas(tema, modo, n){
  if(tema !== "todos") return mezclar(elegirDeGrupo(disponibles(tema), modo, n).elegidas);

  /* "todos": cuota por tema (área), pareja entre las áreas que tengan preguntas,
     y dentro de cada área se respeta la mezcla de dificultad. Si a un área le
     faltan preguntas para su cuota, el resto se rellena con las demás. */
  const temas = mezclar([...new Set(PREGUNTAS.map(p => p.tema))]);
  const cuotas = repartirCuota(n, temas.length);
  const elegidas = [], sobrantes = [];
  temas.forEach((t, i) => {
    const { elegidas: e, resto } = elegirDeGrupo(PREGUNTAS.filter(p => p.tema === t), modo, cuotas[i]);
    elegidas.push(...e);
    sobrantes.push(...resto);
  });
  const resto = mezclar(sobrantes);
  while(elegidas.length < n && resto.length) elegidas.push(resto.shift());
  return mezclar(elegidas).slice(0, n);
}

/* ------------------------- estado ------------------------- */
let S = null, reloj = null;
let opciones = { tema: "todos", modo: "estandar" };

function iniciarEnsayo(){
  const preguntas = elegirPreguntas(opciones.tema, opciones.modo, TAMANO_ENSAYO);
  if(!preguntas.length){ renderInicio("No hay preguntas que cumplan esa combinación de tema y dificultad."); return; }
  S = {
    items: preguntas.map(p => ({
      p,
      orden: p.barajar ? mezclar(p.opciones.map((_, i) => i)) : p.opciones.map((_, i) => i),
      marca: null,
      pista: false,
      segs: 0
    })),
    idx: 0,
    inicio: Date.now(),
    entrada: Date.now()
  };
  clearInterval(reloj);
  reloj = setInterval(actualizarReloj, 1000);
  renderPregunta();
}

function salirDeActual(){
  if(!S) return;
  const ahora = Date.now();
  S.items[S.idx].segs += (ahora - S.entrada) / 1000;
  S.entrada = ahora;
}
function irA(i){ if(i < 0 || i >= S.items.length) return; salirDeActual(); S.idx = i; renderPregunta(); }
function marcar(orig){ const it = S.items[S.idx]; it.marca = (it.marca === orig) ? null : orig; renderPregunta(true); }
function terminar(){ salirDeActual(); clearInterval(reloj); S.total = (Date.now() - S.inicio)/1000; renderReporte(); }
function actualizarReloj(){ const el = document.getElementById("reloj"); if(el && S) el.textContent = fmt((Date.now()-S.inicio)/1000); }

const acerto = x => x.marca !== null && x.marca === x.p.respuesta;
const puntos = x => acerto(x) ? (x.pista ? VALOR_CON_PISTA : 1) : 0;

/* ------------------------- vistas ------------------------- */
function renderInicio(aviso){
  S = null;
  const secciones = seccionesDisponibles();
  const n = Math.min(TAMANO_ENSAYO, disponibles(opciones.tema).length);
  const cuenta = d => disponibles(opciones.tema).filter(p => p.dificultad === d).length;

  $app.innerHTML = `
    <header class="top"><h1>Simulacro de Física</h1><span class="meta">Banco de ${PREGUNTAS.length} preguntas</span></header>
    <p class="intro">Cada ensayo toma preguntas al azar del banco y cambia el orden de las respuestas cuando tiene sentido.
    Al terminar verás cuáles acertaste, cuáles fallaste y por qué.</p>
    ${aviso ? `<p class="aviso">${esc(aviso)}</p>` : ""}

    <div class="grupo">
      <span class="etiqueta">Tema</span>
      <div class="segmentado" role="group" aria-label="Tema">
        <button data-tema="todos" aria-pressed="${opciones.tema==="todos"}">Todos (${PREGUNTAS.length})</button>
        ${secciones.map(s => `<button data-tema="${s.id}" aria-pressed="${opciones.tema===s.id}">${esc(s.titulo)} (${s.n})</button>`).join("")}
      </div>
    </div>

    <div class="grupo">
      <span class="etiqueta">Dificultad</span>
      <div class="segmentado" role="group" aria-label="Dificultad">
        <button data-modo="estandar" aria-pressed="${opciones.modo==="estandar"}">Estándar</button>
        ${Object.entries(DIFICULTADES).map(([k,v]) =>
          `<button data-modo="${k}" aria-pressed="${opciones.modo===k}">${v} (${cuenta(k)})</button>`).join("")}
      </div>
      <p class="nota">El ensayo estándar mezcla los tres niveles: 30 % fáciles, 45 % medias y 25 % difíciles.
      Con el tema "Todos" además reparte las preguntas por área lo más parejo posible.</p>
    </div>

    <button class="btn primary" id="empezar">Empezar ensayo de ${n} ${n === 1 ? "pregunta" : "preguntas"}</button>
    <p class="nota" style="margin-top:1rem">Atajos: <kbd>1</kbd>–<kbd>5</kbd> marcan una opción, <kbd>←</kbd> <kbd>→</kbd> cambian de pregunta, <kbd>P</kbd> muestra la pista.</p>
    <p class="descargo">Material de práctica escrito para este proyecto, en parte con ayuda de modelos de lenguaje.
    Puede contener errores: revisa siempre la explicación y contrasta con tu libro o tu profesor antes de darla por buena.</p>`;

  $app.querySelectorAll("[data-tema]").forEach(b => b.onclick = () => { opciones.tema = b.dataset.tema; renderInicio(); });
  $app.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => { opciones.modo = b.dataset.modo; renderInicio(); });
  const e = document.getElementById("empezar");
  e.onclick = iniciarEnsayo;
  e.disabled = n === 0;
}

function renderPregunta(mantenerFoco){
  const it = S.items[S.idx], p = it.p, N = S.items.length;
  const respondidas = S.items.filter(x => x.marca !== null).length;
  const posFoco = mantenerFoco && document.activeElement && document.activeElement.dataset
    ? document.activeElement.dataset.pos : null;

  $app.innerHTML = `
    <header class="top">
      <h1>Simulacro de Física</h1>
      <span class="meta">Pregunta <strong>${S.idx+1}</strong> de ${N} &nbsp;|&nbsp; ${respondidas} respondidas &nbsp;|&nbsp; <span id="reloj">${fmt((Date.now()-S.inicio)/1000)}</span></span>
    </header>
    <nav class="mapa" aria-label="Preguntas del ensayo">
      ${S.items.map((x,i) => `<button class="${x.marca!==null?"hecha":""} ${i===S.idx?"aqui":""} ${x.pista?"conpista":""}" data-ir="${i}" aria-label="Ir a la pregunta ${i+1}${x.marca!==null?", respondida":""}">${i+1}</button>`).join("")}
    </nav>
    <article class="hoja">
      <div class="cabecera">
        <span>${esc(rutaTema(p.subtemas && p.subtemas[0] ? p.subtemas[0] : p.tema))}</span>
        <span class="nivel nivel-${p.dificultad}">${DIFICULTADES[p.dificultad] || p.dificultad}</span>
      </div>
      ${figurasHTML(p.figuras)}
      <p class="enunciado">${p.enunciado}</p>
      <ul class="opciones" role="radiogroup" aria-label="Opciones">
        ${it.orden.map((orig,pos) => `
          <li><button class="opcion" role="radio" aria-checked="${it.marca===orig}" data-orig="${orig}" data-pos="${pos}">
            <span class="burbuja" aria-hidden="true">${pos+1}</span><span>${p.opciones[orig]}</span>
          </button></li>`).join("")}
      </ul>
      ${pistaHTML(it)}
    </article>
    <div class="nav">
      <button class="btn quiet" id="prev" ${S.idx===0?"disabled":""}>Anterior</button>
      <span class="nota">${respondidas<N ? (N-respondidas)+" sin responder" : "Todas respondidas"}</span>
      ${S.idx<N-1 ? `<button class="btn primary" id="sig">Siguiente</button>`
                  : `<button class="btn primary" id="fin">Terminar y ver reporte</button>`}
    </div>
    ${S.idx<N-1 ? `<p style="text-align:right;margin-top:.75rem"><button class="btn quiet" id="fin">Terminar ahora</button></p>` : ""}`;

  $app.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => irA(+b.dataset.ir));
  $app.querySelectorAll(".opcion").forEach(b => b.onclick = () => marcar(+b.dataset.orig));
  const prev = document.getElementById("prev"), sig = document.getElementById("sig"), fin = document.getElementById("fin");
  if(prev) prev.onclick = () => irA(S.idx-1);
  if(sig) sig.onclick = () => irA(S.idx+1);
  if(fin) fin.onclick = terminar;
  const bp = document.getElementById("btnpista");
  if(bp) bp.onclick = () => { it.pista = true; renderPregunta(); const c = $app.querySelector(".cajapista"); if(c) c.focus(); };
  if(posFoco !== null){ const f = $app.querySelector(`.opcion[data-pos="${posFoco}"]`); if(f) f.focus(); }
  typeset($app);
}

function renderReporte(){
  const items = S.items;
  const bienSinPista = items.filter(x => acerto(x) && !x.pista).length;
  const bienConPista = items.filter(x => acerto(x) && x.pista).length;
  const blancos = items.filter(x => x.marca === null).length;
  const malas = items.length - bienSinPista - bienConPista - blancos;
  const total = items.reduce((s,x) => s + puntos(x), 0);
  const pct = v => (100*v/items.length).toFixed(1) + "%";

  const porTema = {};
  items.forEach(x => {
    const t = x.p.subtemas && x.p.subtemas[0] ? x.p.subtemas[0] : x.p.tema;
    const r = porTema[t] = porTema[t] || { n:0, ok:0, pista:0, mal:0, blanco:0, pts:0 };
    r.n++; r.pts += puntos(x); if(x.pista) r.pista++;
    if(x.marca === null) r.blanco++; else if(acerto(x)) r.ok++; else r.mal++;
  });

  const porNivel = {};
  items.forEach(x => {
    const r = porNivel[x.p.dificultad] = porNivel[x.p.dificultad] || { n:0, ok:0 };
    r.n++; if(acerto(x)) r.ok++;
  });

  const rango = x => acerto(x) ? (x.pista ? 2 : 3) : (x.marca === null ? 1 : 0);
  const erroresPrimero = items.map((x,i) => ({...x, i})).sort((a,b) => rango(a)-rango(b) || a.i-b.i);

  $app.innerHTML = `
    <header class="top"><h1>Reporte del ensayo</h1>
      <span class="meta">Tiempo total ${fmt(S.total)} &nbsp;|&nbsp; ${fmt(S.total/items.length)} por pregunta (referencia: ${fmt(SEGUNDOS_POR_PREGUNTA)})</span></header>
    <div class="puntaje"><b>${fmtPts(total)} de ${items.length}</b><span>puntos${bienConPista ? ` (${bienConPista} con pista, a ${fmtPts(VALOR_CON_PISTA)} cada uno)` : ""}</span></div>
    <div class="barra" role="img" aria-label="${bienSinPista} correctas sin pista, ${bienConPista} con pista, ${malas} incorrectas, ${blancos} sin responder">
      <i style="width:${pct(bienSinPista)};background:var(--ok)"></i><i style="width:${pct(bienConPista)};background:var(--ok-pista)"></i><i style="width:${pct(malas)};background:var(--mal)"></i>
    </div>
    <div class="leyenda">
      <span style="--c:var(--ok)">${bienSinPista} correctas sin pista</span>
      <span style="--c:var(--ok-pista)">${bienConPista} correctas con pista</span>
      <span style="--c:var(--mal)">${malas} incorrectas</span>
      <span style="--c:var(--regla)">${blancos} sin responder</span>
    </div>

    <h2>Por tema</h2>
    <div class="tabla"><table>
      <thead><tr><th>Tema</th><th class="n">Puntos</th><th class="n">Correctas</th><th class="n">Con pista</th><th class="n">Incorrectas</th><th class="n">En blanco</th></tr></thead>
      <tbody>${Object.entries(porTema).map(([t,r]) =>
        `<tr><td>${esc(tituloTema(t))}</td><td class="n">${fmtPts(r.pts)} / ${r.n}</td><td class="n">${r.ok}</td><td class="n">${r.pista}</td><td class="n">${r.mal}</td><td class="n">${r.blanco}</td></tr>`).join("")}</tbody>
    </table></div>

    <h2>Por dificultad</h2>
    <div class="tabla"><table>
      <thead><tr><th>Nivel</th><th class="n">Aciertos</th></tr></thead>
      <tbody>${["facil","media","dificil"].filter(d => porNivel[d]).map(d =>
        `<tr><td>${DIFICULTADES[d]}</td><td class="n">${porNivel[d].ok} / ${porNivel[d].n}</td></tr>`).join("")}</tbody>
    </table></div>

    <h2>Revisión, empezando por los errores</h2>
    <div class="revision">
      ${erroresPrimero.map(x => {
        const p = x.p;
        const clase = x.marca === null ? "blanco" : (acerto(x) ? (x.pista ? "ok okp" : "ok") : "mal");
        const veredicto = acerto(x) ? (x.pista ? `Correcta con pista (${fmtPts(VALOR_CON_PISTA)})` : "Correcta")
                        : (x.marca === null ? "Sin responder" : (x.pista ? "Incorrecta, con pista" : "Incorrecta"));
        return `<article class="hoja ${clase}">
          <div class="cabecera"><span><span class="veredicto">${veredicto}</span> &nbsp;|&nbsp; pregunta ${x.i+1} del ensayo &nbsp;|&nbsp; ${esc(rutaTema(p.subtemas && p.subtemas[0] ? p.subtemas[0] : p.tema))}</span><span>${fmt(x.segs)}</span></div>
          ${figurasHTML(p.figuras)}
          <p class="enunciado">${p.enunciado}</p>
          ${x.orden.map((orig,pos) => {
            const esC = orig === p.respuesta, esM = orig === x.marca && !esC;
            return `<div class="ropcion ${esC?"es-correcta":""} ${esM?"es-mala":""}">
              <span class="burbuja" aria-hidden="true">${pos+1}</span><span>${p.opciones[orig]}</span>
              ${esC ? `<span class="tag">${x.marca===orig?"Tu respuesta, correcta":"Respuesta correcta"}</span>` : ""}
              ${esM ? `<span class="tag">Tu respuesta</span>` : ""}
            </div>`;}).join("")}
          ${!acerto(x) ? pistasEntradasHTML(p, "expl") : ""}
          ${p.explicacion ? `<div class="expl"><b>Explicación</b>${p.explicacion}</div>` : ""}
        </article>`;}).join("")}
    </div>
    <div class="nav"><button class="btn primary" id="otra">Nuevo ensayo</button><button class="btn quiet" id="inicio">Volver al inicio</button></div>`;

  document.getElementById("otra").onclick = iniciarEnsayo;
  document.getElementById("inicio").onclick = () => renderInicio();
  window.scrollTo(0,0);
  typeset($app);
}

/* ------------------------ teclado ------------------------ */
document.addEventListener("keydown", e => {
  if(!S || S.total || e.metaKey || e.ctrlKey || e.altKey) return;
  const it = S.items[S.idx];
  if(/^[1-5]$/.test(e.key)){ const pos = +e.key - 1; if(pos < it.orden.length) marcar(it.orden[pos]); }
  else if((e.key === "p" || e.key === "P") && pistasDe(it.p).length && !it.pista){ it.pista = true; renderPregunta(); }
  else if(e.key === "ArrowRight") irA(S.idx+1);
  else if(e.key === "ArrowLeft") irA(S.idx-1);
});

/* ------------------------ arranque ------------------------ */
cargarDatos().then(() => {
  PREGUNTAS.forEach(p => {
    (p.pistas || []).forEach(k => { if(!PISTAS[k]) console.warn(`${p.id} usa la pista "${k}", que no existe en pistas.json`); });
    if(!TEMAS[p.tema]) console.warn(`${p.id} usa el tema "${p.tema}", que no existe en temas.json`);
  });
  renderInicio();
}).catch(err => {
  $app.innerHTML = `<header class="top"><h1>Simulacro de Física</h1></header>
    <div class="hoja"><p class="enunciado">No se pudieron cargar los datos (${esc(err.message)}).</p>
    <p class="nota">Si abriste index.html con doble clic, el navegador bloquea la lectura de los JSON. Sirve la carpeta con
    <kbd>python3 -m http.server</kbd> y abre http://localhost:8000, o publica el repositorio con GitHub Pages.
    También puedes generar un archivo único con <kbd>python3 scripts/build.py</kbd>.</p></div>`;
});
