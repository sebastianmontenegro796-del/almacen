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
    <div class="cr-fijo" id="crFijo" hidden>
      <div class="cr-fijo-cab"><span>📍 Todo va a <b id="crFijoCod"></b></span>
        <button type="button" class="btn sm link" id="crFijoQuitar">Quitar</button></div>
      <div class="cr-elige cr-fijo-tipo"><span data-def="SALIDA">− Sale</span><span data-def="ENTRADA">+ Entra</span></div>
      <small class="muted">Solo di producto y cantidad: «Kinder Bueno 3 cajas».</small>
      <div class="cr-chips" id="crChips" hidden></div>
    </div>
    <textarea id="crTexto" class="cr-texto" spellcheck="false" autocomplete="off"
      placeholder="+ F4 Kinder Bueno 3 cajas&#10;+ FM Bom Bom Bum fresa 2 cajas&#10;- SS Tortolines sal 1 caja"></textarea>
    <div class="cr-escucha" id="crEscucha" hidden><span class="cr-ondas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span>Escuchando… <i id="crParcial"></i></span></div>
    <div class="cr-fila">
      <button type="button" class="btn cr-mic" id="crMic">🎤 Dictar</button>
      <button type="button" class="btn cr-big" id="crPegar">📋 Pegar</button>
    </div>
    <button type="button" class="btn primary cr-big cr-ancho" id="crRevisar">Revisar →</button>
    <div class="cr-ayuda">
      <b>+</b> entra · <b>−</b> sale · luego <b>sitio</b>, <b>producto</b> y <b>cantidad</b>.<br>
      Por voz: «entra F4 Kinder Bueno 3 cajas», «sale ese ese Tortolines sal 1 caja».
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
      <button type="button" class="btn cr-big cr-ancho" id="crVolverSitio" hidden></button>
    </div>
   </div>`;
  document.querySelector('main').appendChild(vista);

  const txt = $('#crTexto');
  txt.value = leerBorrador();
  txt.addEventListener('input', () => guardarBorrador(txt.value));
  function paso(n) {
    [1, 2, 3].forEach(i => { $('#crPaso' + i).hidden = i !== n; });
    if (n === 1 && chips.length) pintarChips();
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
  tab.onclick = () => { showView('carga'); fijar(null); if (!$('#crPaso3').hidden) paso(1); };

  /* ---------- Modo «desde un palet»: el sitio ya viene puesto ---------- */
  let sitioFijo = null, tipoDef = 'SALIDA';
  const PH_NORMAL = txt.placeholder, PH_FIJO = 'Kinder Bueno 3 cajas\nTortolines sal 1 caja\n(o con + / − delante para cambiar entra o sale)';
  function fijar(cod, tipo) {
    sitioFijo = cod || null;
    if (tipo) tipoDef = tipo;
    $('#crFijo').hidden = !sitioFijo;
    $('#crFijoCod').textContent = sitioFijo || '';
    txt.placeholder = sitioFijo ? PH_FIJO : PH_NORMAL;
    $('#crFijo').querySelectorAll('[data-def]').forEach(s => s.classList.toggle('sel', s.dataset.def === tipoDef));
    const v = $('#crVolverSitio'); v.hidden = !sitioFijo; v.textContent = sitioFijo ? `← Volver a ${sitioFijo}` : '';
    if (cod !== chipsDe) cargarChips();
  }

  /* ---------- Botones con los productos de ese sitio: cada toque suma 1 a su línea ---------- */
  let chips = [], chipsDe = null;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reLinea = p => new RegExp('^(\\s*(?:[+＋−–—-]\\s*)?)' + escRe(p.nombre) + '\\s+(\\d+(?:[.,]\\d+)?)\\b.*$', 'i');
  const textoCant = (p, n) => unidadNorm(p.unidad) ? cantUd(n, p.unidad) : fmt(n);   // si la unidad es rara, solo el número
  async function cargarChips() {
    chipsDe = sitioFijo; chips = [];
    $('#crChips').hidden = true; $('#crChips').innerHTML = '';
    if (!sitioFijo) return;
    try {
      const pedido = sitioFijo;
      const todos = await api('productos');
      if (pedido !== sitioFijo) return;
      chips = todos.filter(p => p.ubicacion === sitioFijo).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      pintarChips();
    } catch {}
  }
  function cuentaEnTexto(p) {
    const re = reLinea(p);
    for (const l of txt.value.split('\n')) { const m = l.match(re); if (m) return Number(m[2].replace(',', '.')); }
    return 0;
  }
  function pintarChips() {
    const box = $('#crChips');
    box.hidden = !chips.length;
    box.innerHTML = chips.length ? '<small class="muted cr-chips-tit">Toca para sumar 1:</small>' + chips.map((p, i) => {
      const n = cuentaEnTexto(p);
      return `<button type="button" class="cr-chip${n ? ' on' : ''}" data-chip="${i}">${esc(p.nombre)}${n ? ` <b>${fmt(n)}</b>` : ''}</button>`;
    }).join('') : '';
  }
  $('#crChips').addEventListener('click', e => {
    const b = e.target.closest('[data-chip]'); if (!b) return;
    const p = chips[+b.dataset.chip], re = reLinea(p);
    const lineas = txt.value.trim() ? txt.value.trimEnd().split('\n') : [];
    const i = lineas.findIndex(l => re.test(l));
    if (i >= 0) { const m = lineas[i].match(re); lineas[i] = m[1] + p.nombre + ' ' + textoCant(p, Number(m[2].replace(',', '.')) + 1); }
    else lineas.push(p.nombre + ' ' + textoCant(p, 1));
    txt.value = lineas.join('\n'); guardarBorrador(txt.value);
    if (navigator.vibrate) navigator.vibrate(15);
    pintarChips();
  });
  txt.addEventListener('input', () => { if (chips.length) pintarChips(); });

  /* ---------- Entrada rápida desde la ficha del palet: +1 sin formulario, con «Deshacer» ---------- */
  window.entradaRapida = async (p, btn) => {
    if (!p) return;
    if (btn) btn.disabled = true;
    try {
      await api('movimiento', {}, {id: p.id, tipo: 'ENTRADA', cantidad: 1, nota: 'Entrada rápida'});
      if (navigator.vibrate) navigator.vibrate(30);
      avisoDeshacer(`${p.nombre} +${cantUd(1, p.unidad)}`, async () => {
        await api('movimiento', {}, {id: p.id, tipo: 'SALIDA', cantidad: 1, nota: 'Deshacer entrada rápida'});
        toast('Deshecho'); refresh();
      });
      refresh();
    } catch (err) { toast(err.message); if (btn) btn.disabled = false; }
  };
  function avisoDeshacer(msg, fn) {
    document.querySelectorAll('.toast-deshacer').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'toast toast-deshacer';
    t.innerHTML = `<span>✓ ${esc(msg)}</span><button type="button">Deshacer</button>`;
    t.querySelector('button').onclick = () => { t.remove(); fn().catch(err => toast(err.message)); };
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }
  $('#crFijo').addEventListener('click', e => { const s = e.target.closest('[data-def]'); if (s) fijar(sitioFijo, s.dataset.def); });
  $('#crFijoQuitar').onclick = () => fijar(null);
  $('#crVolverSitio').onclick = () => {
    const cod = sitioFijo;
    showView('mapa'); if (typeof ponerMapa === 'function') ponerMapa(true);
    if (cod) showDetail(cod);
  };
  // Se abre desde la ficha de un palet / ubicación
  window.abrirCargaEn = (cod, tipo) => {
    chipsDe = undefined;   // vuelve a leer los productos del sitio (por si hay alguno nuevo)
    showView('carga'); fijar(cod, tipo || 'SALIDA'); paso(1);
    setTimeout(() => txt.focus(), 300);
  };

  /* ---------- Leer cada línea ---------- */
  const NUM = {dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20};
  const UD = '(medios?\\s+pal(?:e|é|et)s?|pal(?:e|é|et)s?|cajas?|filas?|unidad(?:es)?|uds?|und)';
  const RE_UD = new RegExp('(?:^|\\s)(\\d+(?:[.,]\\d+)?)?\\s*' + UD + '(?=\\s|$|[.,;])', 'i');
  const ENTRA = /^(?:entra[n]?|entrada|mete[rn]?|meto|a[ñn]ad[eio]r?|agrega[r]?|suma[r]?|carga[r]?)\b[\s:,]*/i;
  const SALE = /^(?:sale[n]?|salida|saca[rn]?|saco|quita[rn]?|quito|resta[r]?|retira[r]?)\b[\s:,]*/i;
  const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'a', 'al', 'y', 'con', 'x', 'por', 'ubicacion', 'sitio', 'hueco']);
  let codigos = new Set();

  // Dónde empieza otro producto aunque venga todo en una sola línea (como lo pega a veces ChatGPT):
  //  «… 6 cajas + F1M …», «… 6 cajas - S1 …», «… 3 cajas entra F4 …», «…, y sale …», «1. … 2. …»
  const SITIO = '(?:(?:est\\w*|[fidspe])\\s*-?\\d{1,2}m?|fm|s[smb])\\b';
  const CORTE = new RegExp(
    '\\s*(?:,|;|\\by\\b)\\s+(?=(?:entra[n]?|sale[n]?|saca[n]?|mete[n]?|quita[n]?)\\b)' +
    '|\\s+(?=[+＋−–—-]\\s*' + SITIO + ')' +
    '|\\s+(?=(?:entra[n]?|sale[n]?|saca[n]?|mete[n]?|quita[n]?)\\s)' +
    '|\\s+(?=\\d{1,2}[.)]\\s+(?:[+＋−–—-]|entra|sale|saca|mete|quita|' + SITIO + '))', 'i');
  function partirLineas(texto) {
    const out = [];
    texto.replace(/\\([-+*_#.()!\[\]])/g, '$1')        // ChatGPT a veces escribe «\+» y «\-»
      .split(/\r\n|\r|\n|\u2028|\u2029/).forEach(l => {
      let trozos = l.split(CORTE).map(x => x.replace(/^\s*(?:[•*·]|\d+[.)])\s+/, '').replace(/\*\*/g, '').trim()).filter(x => x && !/^\d+[.)]?$/.test(x));
      // si un trozo no tiene ningún número, no era otro producto: se vuelve a pegar al anterior
      trozos = trozos.reduce((a, x) => {
        if (a.length && !/\d/.test(x) && !/^[+＋−–—-]/.test(x)) a[a.length - 1] += ' ' + x; else a.push(x);
        return a;
      }, []);
      trozos.forEach(x => { if (x && !x.startsWith('#')) out.push(x); });
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
        let cod = pre + Number(m[2]) + (m[3] ? 'M' : '');
        if (!codigos.has(cod) && /^F\d+M$/.test(cod) && codigos.has('FM')) cod = 'FM';  // los antiguos F1M–F6M ahora son FM
        if (codigos.has(cod)) return {cod, resto: (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim()};
      }
    }
    // 3) ubicaciones sin número: FM (fondo medio) y SS / SM / SB (derecha del fondo, arriba / medio / abajo)
    //    también dichas: «efe eme», «ese ese», «ese eme», «ese be»
    const SIN_NUM = [
      [/(?:^|[\s,:;(])(fm|ss|sm|sb)(?=$|[\s,.;:)])/i, m => m[1].toUpperCase()],
      [/(?:^|[\s,:;(])(efe\s+eme|ese\s+ese|ese\s+eme|ese\s+be)(?=$|[\s,.;:)])/i,
        m => ({'efe eme': 'FM', 'ese ese': 'SS', 'ese eme': 'SM', 'ese be': 'SB'})[norm(m[1]).replace(/\s+/g, ' ')]],
    ];
    for (const [re, a] of SIN_NUM) {
      const m = s.match(re);
      if (m && codigos.has(a(m))) return {cod: a(m), resto: (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim()};
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
      if (sitioFijo) { if (!l.ubic) l.ubic = sitioFijo; if (!l.tipo) l.tipo = tipoDef; }
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
    if (chips.length) pintarChips();
  };
  $('#crCopiarGPT').onclick = async () => {
    const prompt = 'Pásame la lista para mi almacén dentro de un bloque de código (texto plano), con este formato exacto, ' +
      'CADA PRODUCTO EN SU PROPIA LÍNEA, sin viñetas, sin negritas, sin barras invertidas y sin nada más:\n' +
      '+ UBICACIÓN PRODUCTO CANTIDAD UNIDAD   (para lo que entra)\n' +
      '- UBICACIÓN PRODUCTO CANTIDAD UNIDAD   (para lo que sale)\n' +
      'Ubicaciones válidas: F1–F6 (fondo arriba), FM (fondo medio), I1–I19, D1–D15, EST1–EST6, ' +
      'SS / SM / SB (derecha del fondo: arriba / medio / abajo), P1–P3, E1–E2.\n' +
      'Unidades: palé, medio palé, fila, caja, unidad.\n' +
      'Ejemplo:\n+ F4 Kinder Bueno 3 cajas\n- SS Tortolines sal 1 caja';
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
