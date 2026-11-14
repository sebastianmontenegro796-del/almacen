'use strict';
/* =========================================================
   Carga rápida — meter y sacar stock de golpe
   - Pegar una lista (por ejemplo, hecha con ChatGPT) o dictarla por voz
   - Formato de cada línea:  + F4 Kinder Bueno 3 cajas   /   - S1 Happy Party 1 palé
     (también vale «entra …», «sale …», «saca …», «mete …»)
   - Antes de guardar se revisa todo: verde = listo, amarillo = elegir, rojo = error
   - Se guarda todo junto (si algo falla en el servidor, no se guarda nada)
   Usa api(), toast(), esc(), fmt(), cantUd(), unidadNorm(), $, showView() y refresh() de app.js.
   ========================================================= */
(function () {
  const BORRADOR = 'seba_carga_borrador';
  const guardarBorrador = v => { try { v ? localStorage.setItem(BORRADOR, v) : localStorage.removeItem(BORRADOR); } catch {} };
  const leerBorrador = () => { try { return localStorage.getItem(BORRADOR) || ''; } catch { return ''; } };
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /* ---------- Pantalla (se añade sola) ---------- */
  const nav = document.querySelector('.tabs');
  const tab = document.createElement('button');
  tab.dataset.view = 'carga'; tab.innerHTML = '<span aria-hidden="true">⚡</span> Carga';
  const despuesDe = nav.querySelector('[data-view="productos"]');
  despuesDe ? despuesDe.after(tab) : nav.appendChild(tab);

  const vista = document.createElement('section');
  vista.id = 'view-carga'; vista.className = 'view';
  vista.innerHTML = `
   <div class="cr" id="crPaso1">
    <h2 class="cr-tit">⚡ Carga rápida</h2>
    <p class="muted cr-sub">Pega la lista de ChatGPT o díctala. Una línea por producto.</p>
    <textarea id="crTexto" class="cr-texto" spellcheck="false" autocomplete="off"
      placeholder="+ F4 Kinder Bueno 3 cajas&#10;+ F5 Pictolín 2 cajas&#10;- S1 Happy Party 1 palé"></textarea>
    <div class="cr-escucha" id="crEscucha" hidden><span class="cr-ondas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span>Escuchando… <i id="crParcial"></i></span></div>
    <div class="cr-fila">
      <button type="button" class="btn cr-mic" id="crMic">🎤 Dictar</button>
      <button type="button" class="btn cr-big" id="crPegar">📋 Pegar</button>
    </div>
    <button type="button" class="btn primary cr-big cr-ancho" id="crRevisar">Revisar →</button>
    <div class="cr-ayuda">
      <b>+</b> entra · <b>−</b> sale · luego <b>sitio</b>, <b>producto</b> y <b>cantidad</b>.<br>
      Por voz: «entra F4 Kinder Bueno 3 cajas», «sale S1 Happy Party 1 palé».
      <div class="cr-ayuda-btns">
        <button type="button" class="btn sm" id="crCopiarGPT">Copiar instrucciones para ChatGPT</button>
        <button type="button" class="btn sm link" id="crBorrar">Vaciar</button>
      </div>
    </div>
   </div>

   <div class="cr" id="crPaso2" hidden>
    <h2 class="cr-tit">Revisa antes de guardar</h2>
    <div class="cr-resumen" id="crResumen"></div>
    <div class="cr-lista" id="crLista"></div>
    <p class="error" id="crError"></p>
    <div class="cr-fila cr-pie">
      <button type="button" class="btn cr-big" id="crVolver">← Corregir</button>
      <button type="button" class="btn primary cr-big" id="crGuardar">Guardar</button>
    </div>
    <p class="muted cr-nota">Lo rojo y lo amarillo sin elegir no se guarda.</p>
   </div>

   <div class="cr" id="crPaso3" hidden>
    <div class="cr-fin">
      <div class="cr-check" aria-hidden="true">✓</div>
      <h2 class="cr-tit">¡Guardado!</h2>
      <p class="muted" id="crFinTxt"></p>
      <div class="cr-hecho" id="crHecho"></div>
      <p class="muted cr-nota">También queda apuntado en Movimientos.</p>
      <button type="button" class="btn primary cr-big cr-ancho" id="crOtra">Hacer otra carga</button>
    </div>
   </div>`;
  document.querySelector('main').appendChild(vista);

  const txt = $('#crTexto');
  txt.value = leerBorrador();
  txt.addEventListener('input', () => guardarBorrador(txt.value));
  function paso(n) {
    [1, 2, 3].forEach(i => { $('#crPaso' + i).hidden = i !== n; });
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  tab.onclick = () => { showView('carga'); if (!$('#crPaso3').hidden) paso(1); };

  /* ---------- Leer cada línea ---------- */
  const NUM = {dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20};
  const UD = '(medios?\\s+pal(?:e|é|et)s?|pal(?:e|é|et)s?|cajas?|filas?|unidad(?:es)?|uds?|und)';
  const RE_UD = new RegExp('(?:^|\\s)(\\d+(?:[.,]\\d+)?)?\\s*' + UD + '(?=\\s|$|[.,;])', 'i');
  const ENTRA = /^(?:entra[n]?|entrada|mete[rn]?|meto|a[ñn]ad[eio]r?|agrega[r]?|suma[r]?|carga[r]?)\b[\s:,]*/i;
  const SALE = /^(?:sale[n]?|salida|saca[rn]?|saco|quita[rn]?|quito|resta[r]?|retira[r]?)\b[\s:,]*/i;
  const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'a', 'al', 'y', 'con', 'x', 'por', 'ubicacion', 'sitio', 'hueco']);
  let codigos = new Set();

  function partirLineas(texto) {
    const out = [];
    texto.split(/\r?\n/).forEach(l => {
      // «… y sale …» dicho de corrido se parte en dos líneas
      l.split(/\s*(?:,|;|\by\b)\s+(?=(?:entra[n]?|sale[n]?|saca|mete|quita)\b)/i).forEach(x => {
        x = x.replace(/^\s*(?:[•*·]|\d+[.)])\s+/, '').trim();
        if (x && !x.startsWith('#')) out.push(x);
      });
    });
    return out;
  }

  function buscarUbic(s) {
    // 1) letras tal cual: F4, F4M, EST3, I12, D 3, s1… / 2) letras dichas: «efe 4», «ese 1», «pe 2», «de 3»
    const pases = [
      /(?:^|[\s,:;(])(est(?:anteria|antería)?|[fidspe])\s*-?\s*(\d{1,2})(\s*(?:m\b|medio\b(?!\s*pal)|eme\b))?(?=$|[\s,.;:)])/gi,
      /(?:^|[\s,:;(])(efe|ese|pe|de|i)\s+(\d{1,2})(\s+(?:m\b|medio\b(?!\s*pal)|eme\b))?(?=$|[\s,.;:)])/gi,
    ];
    const LETRA = {efe: 'F', ese: 'S', pe: 'P', de: 'D', i: 'I'};
    for (const re of pases) {
      for (const m of s.matchAll(re)) {
        let pre = norm(m[1]);
        pre = pre.startsWith('est') ? 'EST' : (LETRA[pre] || pre.toUpperCase());
        const cod = pre + Number(m[2]) + (m[3] ? 'M' : '');
        if (codigos.has(cod)) return {cod, resto: (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim()};
      }
    }
    return {cod: null, resto: s};
  }

  function leerLinea(raw) {
    let s = ' ' + raw + ' ';
    s = s.replace(/\b(un|una|uno)\b(?=\s+(?:medios?\s+)?(?:pal|caja|fila|unidad|ud))/gi, '1')
         .replace(/[a-záéíóúñ]+/gi, w => NUM[norm(w)] !== undefined ? String(NUM[norm(w)]) : w)
         .replace(/\s+/g, ' ').trim();
    let tipo = null;
    const sig = s.match(/^([+＋]|[-−–—])\s*/);
    if (sig) { tipo = sig[1] === '+' || sig[1] === '＋' ? 'ENTRADA' : 'SALIDA'; s = s.slice(sig[0].length); }
    else if (ENTRA.test(s)) { tipo = 'ENTRADA'; s = s.replace(ENTRA, ''); }
    else if (SALE.test(s)) { tipo = 'SALIDA'; s = s.replace(SALE, ''); }

    const u = buscarUbic(s); s = u.resto;

    let cant = null, unidad = null;
    const mu = s.match(RE_UD);
    if (mu) {
      const k = norm(mu[2]).replace(/\s+/g, ' ');
      unidad = /^medios? /.test(k) ? 'Medio palé' : (unidadNorm(k) || unidadNorm(k.replace(/s$/, '')));
      cant = mu[1] ? Number(mu[1].replace(',', '.')) : 1;
      s = (s.slice(0, mu.index) + ' ' + s.slice(mu.index + mu[0].length));
    } else {
      const nums = [...s.matchAll(/(?:^|\s)(\d+(?:[.,]\d+)?)(?=\s|$)/g)];
      if (nums.length) {
        const m = nums[nums.length - 1];
        cant = Number(m[1].replace(',', '.'));
        s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
      }
    }
    let palabras = s.replace(/[|:;·]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    while (palabras.length && RELLENO.has(norm(palabras[0]))) palabras.shift();
    while (palabras.length && RELLENO.has(norm(palabras[palabras.length - 1]))) palabras.pop();
    const nombre = palabras.join(' ').replace(/^[-–,.]+|[-–,.]+$/g, '').trim();
    return {raw, tipo, ubic: u.cod, cant, unidad, nombre};
  }

  /* ---------- Buscar el producto ---------- */
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
  function candidatos(l, productos) {
    if (!l.nombre) return [];
    const lista = productos.map(p => ({p, ...parecido(l.nombre, p)})).filter(c => c.s1 >= 0.5);
    lista.sort((a, b) => (b.p.ubicacion === l.ubic) - (a.p.ubicacion === l.ubic) || b.total - a.total);
    return lista;
  }

  /* ---------- Preparar la revisión ---------- */
  let items = [];
  function preparar(productos) {
    items = partirLineas(txt.value).map(raw => {
      const l = leerLinea(raw);
      const it = {...l, opciones: [], sel: -1, fijo: null, aviso: ''};
      const cands = candidatos(l, productos);
      const enSitio = l.ubic ? cands.filter(c => c.p.ubicacion === l.ubic) : cands;
      const claro = list => list.length && list[0].s1 >= 0.99 && (list.length === 1 || list[0].total - list[1].total > 0.2);
      if (claro(enSitio)) it.fijo = {id: enSitio[0].p.id, p: enSitio[0].p};
      else {
        it.varios = enSitio.length > 1;
        const vistos = new Set();
        (enSitio.length ? enSitio : cands).concat(cands).forEach(c => {
          if (it.opciones.length >= 3 || vistos.has(c.p.id)) return;
          vistos.add(c.p.id);
          it.opciones.push({label: `${c.p.nombre}${c.p.ubicacion ? ' (' + c.p.ubicacion + ')' : ''}`, val: {id: c.p.id, p: c.p}});
        });
        if (l.tipo !== 'SALIDA' && l.nombre && l.ubic) {
          it.opciones.unshift({label: `Crear nuevo en ${l.ubic}`, val: {nuevo: {nombre: l.nombre, ubicacion: l.ubic, unidad: l.unidad || 'Unidad'}}});
          if (it.opciones.length === 1) it.sel = 0;  // no hay nada parecido: se propone crearlo
        }
      }
      return it;
    });
  }

  function evaluar() {
    const stock = new Map();
    let ok = 0, elegir = 0, mal = 0;
    items.forEach(it => {
      it.estado = 'ok'; it.msg = '';
      const eleccion = it.fijo || (it.sel >= 0 ? it.opciones[it.sel].val : null);
      if (it.borrado) { it.estado = 'fuera'; return; }
      if (!it.tipo) { it.estado = 'elige-tipo'; it.msg = '¿Entra o sale?'; }
      if (!it.nombre) { it.estado = 'error'; it.msg = 'No entiendo qué producto es'; }
      else if (it.cant === null || !(it.cant > 0)) { it.estado = 'error'; it.msg = 'Falta la cantidad'; }
      else if (!eleccion) {
        if (it.opciones.length) { it.estado = 'elige'; it.msg = it.varios ? `Hay varios parecidos${it.ubic ? ' en ' + it.ubic : ''}. ¿Cuál es?`
          : it.ubic ? `No lo encuentro en ${it.ubic}. ¿Cuál es?` : '¿Cuál de estos es?'; }
        else if (it.tipo === 'SALIDA') { it.estado = 'error'; it.msg = 'No encuentro ese producto en el almacén'; }
        else { it.estado = 'error'; it.msg = 'Producto nuevo: di dónde va (por ejemplo F4)'; }
      } else if (it.tipo && eleccion.p) {
        const p = eleccion.p, ud = unidadNorm(p.unidad) || p.unidad;
        const antes = stock.has(p.id) ? stock.get(p.id) : Number(p.cantidad);
        const despues = antes + (it.tipo === 'ENTRADA' ? it.cant : -it.cant);
        it.avisoUd = it.unidad && unidadNorm(p.unidad) && it.unidad !== unidadNorm(p.unidad) ? ` · ojo: este producto se cuenta en ${cantUd(2, p.unidad).replace(/^2 /, '')}` : '';
        if (despues < 0) { it.estado = 'error'; it.msg = `${p.ubicacion || ''} · solo hay ${cantUd(antes, ud)}, no puedes sacar ${fmt(it.cant)}`; }
        else { stock.set(p.id, despues); it.msg = `${p.ubicacion || 'sin sitio'} · ahora ${fmt(antes)} → quedará${despues === 1 ? '' : 'n'} ${cantUd(despues, ud)}${it.avisoUd}`; }
      } else if (it.tipo && eleccion.nuevo) {
        it.msg = `Nuevo en ${eleccion.nuevo.ubicacion} · ${cantUd(it.cant, eleccion.nuevo.unidad)}`;
        if (it.tipo === 'SALIDA') { it.estado = 'error'; it.msg = 'No se puede sacar un producto que no existe'; }
      }
      if (it.estado === 'ok') ok++; else if (it.estado === 'error') mal++; else elegir++;
    });
    return {ok, elegir, mal};
  }

  function pintar() {
    const r = evaluar();
    $('#crResumen').innerHTML =
      `<span class="cr-r-ok">${r.ok} listo${r.ok === 1 ? '' : 's'}</span>` +
      `<span class="cr-r-amb">${r.elegir} a elegir</span>` +
      `<span class="cr-r-mal">${r.mal} error${r.mal === 1 ? '' : 'es'}</span>`;
    $('#crLista').innerHTML = items.map((it, i) => {
      if (it.estado === 'fuera') return '';
      const ele = it.fijo || (it.sel >= 0 ? it.opciones[it.sel].val : null);
      const titulo = ele && ele.p ? ele.p.nombre : (it.nombre || it.raw);
      const icono = {ok: '✅', error: '❌'}[it.estado] || (ele && ele.nuevo ? '🆕' : '❓');
      const clase = {ok: 'ok', error: 'err'}[it.estado] || 'amb';
      const signo = it.tipo === 'ENTRADA' ? '+' : it.tipo === 'SALIDA' ? '−' : '?';
      const tag = `<button type="button" class="cr-tag ${it.tipo === 'SALIDA' ? 'out' : it.tipo ? 'in' : 'nada'}" data-signo="${i}" title="Cambiar entra / sale">${signo}${it.cant > 0 ? fmt(it.cant) : ''}</button>`;
      let elige = '';
      if (!it.tipo) elige += `<div class="cr-elige"><span data-tipo="${i}:ENTRADA">Entra</span><span data-tipo="${i}:SALIDA">Sale</span></div>`;
      if (!it.fijo && it.opciones.length)
        elige += `<div class="cr-elige">${it.opciones.map((o, k) => `<span class="${k === it.sel ? 'sel' : ''}" data-op="${i}:${k}">${esc(o.label)}</span>`).join('')}</div>`;
      return `<div class="cr-it ${clase}">
        <span class="cr-ic" aria-hidden="true">${icono}</span>
        <div class="cr-t"><b>${esc(titulo)}</b><small>${esc(it.msg)}</small>${elige}
          <small class="cr-raw">«${esc(it.raw)}»</small></div>
        <div class="cr-der">${tag}<button type="button" class="cr-x" data-quitar="${i}" aria-label="Quitar esta línea">✕</button></div>
      </div>`;
    }).join('') || '<p class="muted">No queda nada en la lista.</p>';
    const n = r.ok;
    $('#crGuardar').textContent = n ? `Guardar ${n}` : 'Nada que guardar';
    $('#crGuardar').disabled = !n;
  }

  $('#crLista').addEventListener('click', e => {
    const t = e.target.closest('[data-op],[data-tipo],[data-signo],[data-quitar]');
    if (!t) return;
    if (t.dataset.op) { const [i, k] = t.dataset.op.split(':').map(Number); items[i].sel = items[i].sel === k ? -1 : k; }
    else if (t.dataset.tipo) { const [i, v] = t.dataset.tipo.split(':'); items[+i].tipo = v; }
    else if (t.dataset.signo) { const it = items[+t.dataset.signo]; it.tipo = it.tipo === 'ENTRADA' ? 'SALIDA' : 'ENTRADA'; }
    else if (t.dataset.quitar) items[+t.dataset.quitar].borrado = true;
    pintar();
  });

  $('#crRevisar').onclick = async () => {
    parar();
    if (!partirLineas(txt.value).length) { toast('Escribe, pega o dicta la lista primero'); txt.focus(); return; }
    const b = $('#crRevisar'); b.disabled = true; b.textContent = 'Revisando…';
    try {
      const [productos, ubics] = await Promise.all([api('productos'), api('ubicaciones')]);
      codigos = new Set(ubics.map(u => String(u.codigo).toUpperCase()));
      preparar(productos);
      $('#crError').textContent = '';
      pintar();
      paso(2);
    } catch (err) { toast(err.message); }
    finally { b.disabled = false; b.textContent = 'Revisar →'; }
  };
  $('#crVolver').onclick = () => paso(1);

  $('#crGuardar').onclick = async () => {
    evaluar();
    const listos = items.filter(it => it.estado === 'ok');
    if (!listos.length) return;
    const envio = listos.map(it => {
      const e = it.fijo || it.opciones[it.sel].val;
      return e.nuevo ? {tipo: it.tipo, cantidad: it.cant, nuevo: e.nuevo} : {tipo: it.tipo, cantidad: it.cant, id: e.id};
    });
    const b = $('#crGuardar'); b.disabled = true; b.textContent = 'Guardando…';
    try {
      await api('carga_rapida', {}, {items: envio});
      const ent = listos.filter(x => x.tipo === 'ENTRADA').length, sal = listos.length - ent;
      $('#crFinTxt').textContent = [ent && `${ent} entrada${ent === 1 ? '' : 's'}`, sal && `${sal} salida${sal === 1 ? '' : 's'}`].filter(Boolean).join(' y ');
      $('#crHecho').innerHTML = listos.map(it => {
        const e = it.fijo || it.opciones[it.sel].val;
        const nom = e.p ? e.p.nombre : e.nuevo.nombre + ' (nuevo)';
        const sitio = e.p ? e.p.ubicacion : e.nuevo.ubicacion;
        const ud = e.p ? e.p.unidad : e.nuevo.unidad;
        return `<div><span>${esc(sitio || '')} · ${esc(nom)}</span><b class="${it.tipo === 'ENTRADA' ? 'cr-mas' : 'cr-menos'}">${it.tipo === 'ENTRADA' ? '+' : '−'}${esc(cantUd(it.cant, ud))}</b></div>`;
      }).join('');
      // lo que no se guardó (rojo o sin elegir) se queda en el cuadro para corregirlo
      const quedan = items.filter(it => !it.borrado && it.estado !== 'ok').map(it => it.raw);
      txt.value = quedan.join('\n'); guardarBorrador(txt.value);
      if (quedan.length) $('#crFinTxt').textContent += ` · ${quedan.length} línea${quedan.length === 1 ? '' : 's'} sin guardar (siguen en el cuadro)`;
      paso(3);
      if (navigator.vibrate) navigator.vibrate(60);
      try { await refresh(); } catch {}
    } catch (err) { $('#crError').textContent = err.message; }
    finally { pintar(); }
  };
  $('#crOtra').onclick = () => { paso(1); txt.focus(); };

  /* ---------- Pegar, vaciar, instrucciones para ChatGPT ---------- */
  $('#crPegar').onclick = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) throw new Error('vacío');
      txt.value = (txt.value.trim() ? txt.value.trimEnd() + '\n' : '') + t.trim();
      guardarBorrador(txt.value);
      toast('Lista pegada');
    } catch { txt.focus(); toast('Mantén el dedo en el cuadro y pulsa «Pegar»'); }
  };
  $('#crBorrar').onclick = () => {
    if (txt.value.trim() && !confirm('¿Vaciar el cuadro?')) return;
    txt.value = ''; guardarBorrador(''); txt.focus();
  };
  $('#crCopiarGPT').onclick = async () => {
    const prompt = 'Pásame la lista para mi almacén con este formato exacto, una línea por producto y sin nada más:\n' +
      '+ UBICACIÓN PRODUCTO CANTIDAD UNIDAD   (para lo que entra)\n' +
      '- UBICACIÓN PRODUCTO CANTIDAD UNIDAD   (para lo que sale)\n' +
      'Ubicaciones válidas: F1–F6 (fondo arriba), F1M–F6M (fondo medio), I1–I19, D1–D15, EST1–EST6, S1–S3, P1–P3, E1–E2.\n' +
      'Unidades: palé, medio palé, fila, caja, unidad.\n' +
      'Ejemplo:\n+ F4 Kinder Bueno 3 cajas\n- S1 Happy Party 1 palé';
    try { await navigator.clipboard.writeText(prompt); toast('Copiado. Pégalo en ChatGPT junto a tu lista'); }
    catch { alert(prompt); }
  };

  /* ---------- Dictado por voz ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, escuchando = false;
  function parar() {
    escuchando = false;
    if (rec) { try { rec.stop(); } catch {} }
    $('#crEscucha').hidden = true;
    $('#crMic').textContent = '🎤 Dictar';
    $('#crMic').classList.remove('on');
  }
  function empezar() {
    if (!SR) { toast('Aquí no se puede dictar. Usa el micrófono 🎤 del teclado dentro del cuadro'); txt.focus(); return; }
    rec = new SR();
    rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => {
      let parcial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) {
          if (t) { txt.value = (txt.value.trim() ? txt.value.trimEnd() + '\n' : '') + t; guardarBorrador(txt.value); txt.scrollTop = txt.scrollHeight; }
        } else parcial += t + ' ';
      }
      $('#crParcial').textContent = parcial ? '«' + parcial.trim() + '»' : '';
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { parar(); toast('No hay permiso para el micrófono. Actívalo en los ajustes del navegador'); }
      else if (e.error === 'network') { parar(); toast('Para dictar hace falta internet'); }
    };
    rec.onend = () => { if (escuchando) { try { rec.start(); } catch { parar(); } } };
    try { rec.start(); } catch { toast('No se pudo encender el micrófono'); return; }
    escuchando = true;
    $('#crParcial').textContent = '';
    $('#crEscucha').hidden = false;
    $('#crMic').textContent = '⏹ Parar';
    $('#crMic').classList.add('on');
  }
  $('#crMic').onclick = () => escuchando ? parar() : empezar();
  document.addEventListener('visibilitychange', () => { if (document.hidden && escuchando) parar(); });
})();
