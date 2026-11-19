'use strict';
/* =========================================================
   Buscar lista — «¿qué hay y dónde?»
   - Pegas o dictas la lista de lo que te falta (en la estantería, en un pedido…)
   - La compara con lo que hay en el almacén y dice, de cada cosa:
     ✅ hay (en qué sitios y cuánto) · ⚠️ hay poco / a 0 / parecidos · ❌ no hay
   - Al final, el recorrido ordenado por ubicación para ir a buscarlo
   Solo LEE datos: no cambia nada del almacén.
   Usa api(), toast(), esc(), fmt(), cantUd(), $, showView() de app.js.
   ========================================================= */
(function () {
  const BORRADOR = 'seba_buscar_borrador';
  const guardarBorrador = v => { try { v ? localStorage.setItem(BORRADOR, v) : localStorage.removeItem(BORRADOR); } catch {} };
  const leerBorrador = () => { try { return localStorage.getItem(BORRADOR) || ''; } catch { return ''; } };
  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- Pantalla (se añade sola, se abre desde Inicio) ---------- */
  const vista = document.createElement('section');
  vista.id = 'view-buscar'; vista.className = 'view';
  vista.innerHTML = `
   <div class="cr" id="blPaso1">
    <h2 class="cr-tit">🔎 ¿Qué hay y dónde?</h2>
    <p class="muted cr-sub">Pega la lista de lo que te falta. Una cosa por línea (o separadas por comas). La cantidad es opcional.</p>
    <textarea id="blTexto" class="cr-texto" spellcheck="false" autocomplete="off"
      placeholder="Kinder Bueno 3 cajas&#10;Pictolín&#10;Bom Bom Bum fresa 2 cajas"></textarea>
    <div class="cr-fila">
      <button type="button" class="btn cr-big" id="blPegar">📋 Pegar</button>
      <button type="button" class="btn cr-big" id="blBorrar">Vaciar</button>
    </div>
    <button type="button" class="btn primary cr-big cr-ancho" id="blBuscar">Buscar en el almacén →</button>
    <p class="muted cr-nota">Solo mira lo que hay: no cambia nada del stock.</p>
   </div>

   <div class="cr" id="blPaso2" hidden>
    <h2 class="cr-tit">Resultado</h2>
    <div class="cr-resumen" id="blResumen"></div>
    <div class="bl-filtros" id="blFiltros">
      <button type="button" data-f="todo" class="on">Todo</button>
      <button type="button" data-f="hay">Hay</button>
      <button type="button" data-f="ojo">Revisar</button>
      <button type="button" data-f="no">No hay</button>
    </div>
    <div class="cr-lista" id="blLista"></div>
    <div id="blRuta"></div>
    <div class="cr-fila cr-pie">
      <button type="button" class="btn cr-big" id="blVolver">← Cambiar lista</button>
      <button type="button" class="btn primary cr-big" id="blCopiar">📤 Copiar</button>
    </div>
    <p class="muted cr-nota">Toca una ubicación para verla en el mapa.</p>
   </div>`;
  document.querySelector('main').appendChild(vista);

  const txt = $('#blTexto');
  txt.value = leerBorrador();
  txt.addEventListener('input', () => guardarBorrador(txt.value));
  const paso = n => { $('#blPaso1').hidden = n !== 1; $('#blPaso2').hidden = n !== 2; window.scrollTo({top: 0, behavior: 'smooth'}); };

  /* ---------- Leer la lista ---------- */
  const NUM = {un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, quince: 15, veinte: 20};
  const UD = '(medios?\\s+pal(?:e|é|et)s?|pal(?:e|é|et)s?|cajas?|filas?|unidad(?:es)?|uds?|und|paquetes?|bolsas?)';
  const RE_UD = new RegExp('(?:^|\\s)(\\d+(?:[.,]\\d+)?|un|una|uno)?\\s*' + UD + '(?=\\s|$|[.,;)])', 'i');
  const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'a', 'al', 'y', 'con', 'x', 'falta', 'faltan', 'hace', 'falta:', 'me', 'necesito']);

  function partir(texto) {
    return texto.replace(/\\([-+*_#.()!\[\]])/g, '$1')
      .split(/\r\n|\r|\n|\u2028|\u2029|[;,](?!\d)/)
      .map(l => l.replace(/^\s*(?:[•*·+\-−–—]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim())
      .filter(l => l && !/^#/.test(l) && /[a-záéíóúñ]/i.test(l));
  }

  function leer(raw) {
    let s = ' ' + raw + ' ', cant = null, unidad = null;
    const mu = s.match(RE_UD);
    if (mu) {
      const n = mu[1] ? (NUM[norm(mu[1])] || Number(mu[1].replace(',', '.'))) : 1;
      const k = norm(mu[2]);
      unidad = /^medios? /.test(k) ? 'Medio palé' : (unidadNorm(k) || unidadNorm(k.replace(/s$/, '')) || null);
      cant = n; s = s.slice(0, mu.index) + ' ' + s.slice(mu.index + mu[0].length);
    } else {
      const m = s.match(/(?:^|\s)[x×]?\s*(\d+(?:[.,]\d+)?)\s*$/);
      if (m) { cant = Number(m[1].replace(',', '.')); s = s.slice(0, m.index); }
    }
    let p = s.replace(/[()|:·]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    while (p.length && RELLENO.has(norm(p[0]))) p.shift();
    while (p.length && RELLENO.has(norm(p[p.length - 1]))) p.pop();
    return {raw, nombre: p.join(' ').replace(/^[-–,.]+|[-–,.]+$/g, '').trim(), cant, unidad};
  }

  /* ---------- Comparar con el almacén (mismo criterio que la Carga rápida) ---------- */
  const fichas = t => norm(t).split(/[^a-z0-9ñ]+/).filter(x => x.length >= 2 || /\d/.test(x));
  const casa = (a, b) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));
  function parecido(nombre, p) {
    const q = fichas(nombre), t = fichas(p.nombre + ' ' + (p.referencia || ''));
    if (!q.length || !t.length) return {s1: 0, total: 0};
    if (norm(nombre).trim() === norm(p.nombre).trim()) return {s1: 1, total: 3};
    const deQ = q.filter(x => t.some(y => casa(x, y))).length / q.length;
    const tn = fichas(p.nombre);
    const deP = tn.filter(y => q.some(x => casa(x, y))).length / (tn.length || 1);
    return {s1: deQ, total: deQ + 0.35 * deP};
  }

  let res = [], orden = new Map(), filtro = 'todo';
  const sitio = p => p.ubicacion || 'sin sitio';
  const ordenSitio = c => orden.has(c) ? orden.get(c) : 9999;

  function comparar(productos) {
    res = partir(txt.value).map(leer).filter(l => l.nombre).map(l => {
      const c = productos.map(p => ({p, ...parecido(l.nombre, p)})).filter(x => x.s1 >= 0.5);
      const exactos = c.filter(x => x.s1 >= 0.99).sort((a, b) => b.total - a.total);
      // todos los que tienen todas las palabras de la lista (así «Party Mix» también enseña «Party Mix (Vidal)»)
      const top = exactos;
      const it = {...l, sitios: [], parecidos: [], total: 0};
      if (top.length) {
        it.sitios = top.map(x => x.p).sort((a, b) => (Number(b.cantidad) > 0) - (Number(a.cantidad) > 0) || ordenSitio(a.ubicacion) - ordenSitio(b.ubicacion));
        it.total = it.sitios.reduce((s, p) => s + Number(p.cantidad), 0);
        const ud = it.sitios[0].unidad;
        const mismaUd = !it.unidad || !unidadNorm(ud) || it.unidad === unidadNorm(ud);
        if (it.total <= 0) { it.estado = 'cero'; it.msg = 'Está apuntado pero a 0: no queda'; }
        else if (it.cant && mismaUd && it.total < it.cant) { it.estado = 'poco'; it.msg = `Pides ${cantUd(it.cant, it.unidad || ud)} y solo hay ${cantUd(it.total, ud)}`; }
        else { it.estado = 'hay'; it.msg = `Hay ${cantUd(it.total, ud)}` + (it.sitios.filter(p => Number(p.cantidad) > 0).length > 1 ? ' en total' : ''); }
      } else if (c.length) {
        it.estado = 'parecido'; it.msg = 'No lo encuentro igual. ¿Es alguno de estos?';
        it.parecidos = c.sort((a, b) => b.total - a.total).slice(0, 4).map(x => x.p);
      } else { it.estado = 'no'; it.msg = 'No hay en el almacén'; }
      return it;
    });
  }

  const GRUPO = {hay: 'hay', poco: 'ojo', cero: 'no', parecido: 'ojo', no: 'no'};
  const chip = p => `<button type="button" class="bl-sitio${Number(p.cantidad) > 0 ? '' : ' vacio'}" data-ir="${esc(p.ubicacion || '')}">` +
    `<b>${esc(sitio(p))}</b> ${esc(cantUd(p.cantidad, p.unidad))}</button>`;

  function pintar() {
    const n = {hay: 0, ojo: 0, no: 0};
    res.forEach(it => n[GRUPO[it.estado]]++);
    $('#blResumen').innerHTML = `<span class="cr-r-ok">${n.hay} hay</span><span class="cr-r-amb">${n.ojo} revisar</span><span class="cr-r-mal">${n.no} no hay</span>`;
    document.querySelectorAll('#blFiltros button').forEach(b => b.classList.toggle('on', b.dataset.f === filtro));
    const lista = res.filter(it => filtro === 'todo' || GRUPO[it.estado] === filtro);
    $('#blLista').innerHTML = lista.map(it => {
      const g = GRUPO[it.estado];
      const icono = {hay: '✅', poco: '⚠️', cero: '⭕', parecido: '❓', no: '❌'}[it.estado];
      const clase = {hay: 'ok', ojo: 'amb', no: 'err'}[g];
      const titulo = it.sitios.length === 1 ? it.sitios[0].nombre : it.nombre;
      let extra = '';
      if (it.sitios.length) {
        const varios = new Set(it.sitios.map(p => norm(p.nombre))).size > 1;
        extra = `<div class="bl-sitios">${it.sitios.map(p => varios ? `<span class="bl-var">${esc(p.nombre)}</span>${chip(p)}` : chip(p)).join('')}</div>`;
      } else if (it.parecidos.length)
        extra = `<div class="bl-sitios">${it.parecidos.map(p => `<span class="bl-var">${esc(p.nombre)}</span>${chip(p)}`).join('')}</div>`;
      return `<div class="cr-it ${clase}"><span class="cr-ic" aria-hidden="true">${icono}</span>
        <div class="cr-t"><b>${esc(titulo)}${it.cant ? ` <span class="bl-pide">· pides ${esc(cantUd(it.cant, it.unidad || (it.sitios[0] || {}).unidad || 'Unidad'))}</span>` : ''}</b>
        <small>${esc(it.msg)}</small>${extra}</div></div>`;
    }).join('') || '<p class="muted">Nada en este apartado.</p>';

    // Recorrido: dónde ir, ordenado como está el almacén
    const paradas = new Map();
    res.filter(it => it.estado === 'hay' || it.estado === 'poco').forEach(it =>
      it.sitios.filter(p => Number(p.cantidad) > 0).forEach(p => {
        const k = p.ubicacion || '';
        if (!paradas.has(k)) paradas.set(k, []);
        paradas.get(k).push(p);
      }));
    const claves = [...paradas.keys()].sort((a, b) => ordenSitio(a) - ordenSitio(b) || a.localeCompare(b));
    $('#blRuta').innerHTML = claves.length && filtro !== 'no' ? `<h3 class="bl-ruta-tit">🧭 Recorrido por ubicación</h3>
      <div class="bl-ruta">${claves.map(k => `<button type="button" class="bl-parada" data-ir="${esc(k)}"><b>${esc(k || 'sin sitio')}</b>
        <span>${paradas.get(k).map(p => `${esc(p.nombre)} <i>(${esc(cantUd(p.cantidad, p.unidad))})</i>`).join(' · ')}</span></button>`).join('')}</div>` : '';
  }

  function textoParaCopiar() {
    const linea = it => {
      const s = it.sitios.filter(p => Number(p.cantidad) > 0).map(p => `${sitio(p)} (${cantUd(p.cantidad, p.unidad)})`).join(', ');
      return `- ${it.sitios.length === 1 ? it.sitios[0].nombre : it.nombre}${s ? ': ' + s : ''}${it.estado === 'poco' ? ' — ' + it.msg : ''}`;
    };
    const bloque = (tit, l) => l.length ? `${tit}\n${l.join('\n')}\n` : '';
    return [
      bloque('✅ HAY', res.filter(it => it.estado === 'hay').map(linea)),
      bloque('⚠️ HAY POCO', res.filter(it => it.estado === 'poco').map(linea)),
      bloque('❓ REVISAR', res.filter(it => it.estado === 'parecido').map(it => `- ${it.nombre} (¿${it.parecidos.map(p => p.nombre + ' en ' + sitio(p)).join(' / ')}?)`)),
      bloque('❌ NO HAY', res.filter(it => it.estado === 'no' || it.estado === 'cero').map(it => `- ${it.nombre}`)),
    ].filter(Boolean).join('\n').trim();
  }

  /* ---------- Botones ---------- */
  $('#blBuscar').onclick = async () => {
    if (!partir(txt.value).length) { toast('Pega o escribe la lista primero'); txt.focus(); return; }
    const b = $('#blBuscar'); b.disabled = true; b.textContent = 'Buscando…';
    try {
      const [productos, ubics] = await Promise.all([api('productos'), api('ubicaciones')]);
      orden = new Map(ubics.map((u, i) => [u.codigo, i]));
      comparar(productos);
      if (!res.length) { toast('No entiendo ningún producto en la lista'); return; }
      filtro = 'todo'; pintar(); paso(2);
    } catch (err) { toast(err.message); }
    finally { b.disabled = false; b.textContent = 'Buscar en el almacén →'; }
  };
  $('#blVolver').onclick = () => paso(1);
  $('#blFiltros').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { filtro = b.dataset.f; pintar(); } };
  vista.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (!b || !b.dataset.ir) return;
    showView('mapa');
    try { if (typeof ponerMapa === 'function') ponerMapa(true); } catch {}
    try { showDetail(b.dataset.ir); } catch {}
  });
  $('#blCopiar').onclick = async () => {
    const t = textoParaCopiar();
    try { await navigator.clipboard.writeText(t); toast('Copiado. Pégalo donde quieras (WhatsApp…)'); }
    catch { alert(t); }
  };
  $('#blPegar').onclick = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) throw new Error('vacío');
      txt.value = (txt.value.trim() ? txt.value.trimEnd() + '\n' : '') + t.trim();
      guardarBorrador(txt.value); toast('Lista pegada');
    } catch { txt.focus(); toast('Mantén el dedo en el cuadro y pulsa «Pegar»'); }
  };
  $('#blBorrar').onclick = () => {
    if (txt.value.trim() && !confirm('¿Vaciar el cuadro?')) return;
    txt.value = ''; guardarBorrador(''); txt.focus();
  };

  window.abrirBuscarLista = () => { showView('buscar'); paso(res.length ? 2 : 1); };
})();
