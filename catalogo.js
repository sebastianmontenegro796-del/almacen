'use strict';
/* =========================================================
   Catálogo de tienda — lector de código de barras con la cámara
   - Pestaña «Catálogo»: lista, buscador, añadir / editar / borrar
   - «Escanear»: lee el código con la cámara y enseña descripción y precio
     (si no está, abre el formulario con el código ya puesto)
   Usa api(), toast(), esc(), $ y showView() de app.js (web y app móvil).
   El catálogo va aparte del inventario: no toca productos ni ubicaciones.
   ========================================================= */
(function () {
  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  const euro = v => v === null || v === undefined || v === '' ? 'Sin precio'
    : Number(v).toLocaleString('es-ES', {style: 'currency', currency: 'EUR'});

  /* ---------- Pantallas (se añaden solas a la página) ---------- */
  const nav = document.querySelector('.tabs');
  const tab = document.createElement('button');
  tab.dataset.view = 'catalogo'; tab.textContent = 'Catálogo';
  nav.appendChild(tab);

  const vista = document.createElement('section');
  vista.id = 'view-catalogo'; vista.className = 'view';
  vista.innerHTML = `
    <div class="cat-escanear-wrap">
      <button type="button" class="btn primary cat-escanear" id="catEscanear">
        <span class="cat-ico" aria-hidden="true"></span> Escanear código de barras
      </button>
    </div>
    <div class="toolbar">
      <input id="catFiltro" type="search" placeholder="Buscar en el catálogo (nombre o código)…" autocomplete="off">
      <button type="button" class="btn" id="catNuevo">+ Añadir</button>
    </div>
    <p class="muted cat-cuenta" id="catCuenta"></p>
    <div class="table-wrap">
      <table class="cat-tabla">
        <thead><tr><th>Producto</th><th>Precio</th><th>Código</th></tr></thead>
        <tbody id="catTabla"></tbody>
      </table>
    </div>`;
  document.querySelector('main').appendChild(vista);

  const dlgs = document.createElement('div');
  dlgs.innerHTML = `
  <dialog id="dlgEscaner" class="dlg-escaner">
    <h2>Escanear código</h2>
    <div class="esc-video">
      <video id="escVideo" playsinline muted></video>
      <div class="esc-marco" aria-hidden="true"><span class="esc-linea"></span></div>
    </div>
    <p class="muted" id="escEstado">Apunta la cámara al código de barras.</p>
    <form id="escManual" class="esc-manual">
      <input name="codigo" inputmode="numeric" placeholder="O escribe el código a mano" autocomplete="off" maxlength="64">
      <button type="submit" class="btn">Buscar</button>
    </form>
    <div class="actions"><span class="spacer"></span><button type="button" class="btn" id="escCerrar">Cerrar</button></div>
  </dialog>

  <dialog id="dlgCatInfo" class="dlg-catinfo">
    <p class="cat-info-etq">Catálogo de tienda</p>
    <h2 id="catInfoDesc"></h2>
    <p class="cat-info-precio" id="catInfoPrecio"></p>
    <p class="muted cat-info-cod" id="catInfoCod"></p>
    <div class="actions">
      <button type="button" class="btn" id="catInfoEditar">Editar</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Cerrar</button>
      <button type="button" class="btn primary" id="catInfoOtro">Escanear otro</button>
    </div>
  </dialog>

  <dialog id="dlgCatForm">
    <form id="catForm" method="dialog">
      <h2 id="catFormTitulo">Añadir al catálogo</h2>
      <p class="muted" id="catFormAviso"></p>
      <input type="hidden" name="id">
      <label>Código de barras *<input name="codigo" required maxlength="64" inputmode="numeric" autocomplete="off"></label>
      <label>Descripción *<input name="descripcion" required maxlength="200" placeholder="Ej.: Coca-Cola lata 33 cl"></label>
      <label>Precio (€)<input name="precio" inputmode="decimal" placeholder="Ej.: 1,25" autocomplete="off"></label>
      <p class="error" id="catFormError"></p>
      <div class="actions">
        <button type="button" class="btn danger" id="catBorrar">Borrar</button>
        <span class="spacer"></span>
        <button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn primary">Guardar</button>
      </div>
    </form>
  </dialog>`;
  document.body.append(...dlgs.children);
  document.querySelectorAll('#dlgCatInfo [data-close], #dlgCatForm [data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());

  /* ---------- Lista ---------- */
  let lista = [], tFiltro = 0;
  async function cargar() {
    try {
      lista = await api('catalogo', {q: $('#catFiltro').value.trim()});
      pintar();
    } catch (e) { $('#catTabla').innerHTML = `<tr><td colspan="3" class="error">${esc(e.message)}</td></tr>`; }
  }
  function pintar() {
    const filtro = $('#catFiltro').value.trim();
    $('#catCuenta').textContent = lista.length
      ? `${lista.length} producto${lista.length === 1 ? '' : 's'}${filtro ? ' encontrados' : ' en el catálogo'}`
      : '';
    $('#catTabla').innerHTML = lista.length ? lista.map(it => `
      <tr data-id="${it.id}" tabindex="0">
        <td class="cat-desc">${esc(it.descripcion)}</td>
        <td class="cat-precio">${esc(euro(it.precio))}</td>
        <td class="cat-cod">${esc(it.codigo)}</td>
      </tr>`).join('')
      : `<tr><td colspan="3" class="muted cat-vacio">${filtro ? 'No hay nada con ese nombre o código.'
          : 'El catálogo está vacío. Pulsa «Escanear código de barras» para añadir el primer producto.'}</td></tr>`;
  }
  $('#catTabla').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) abrirForm(lista.find(x => String(x.id) === tr.dataset.id));
  });
  $('#catTabla').addEventListener('keydown', e => {
    const tr = e.target.closest('tr[data-id]');
    if (tr && e.key === 'Enter') abrirForm(lista.find(x => String(x.id) === tr.dataset.id));
  });
  $('#catFiltro').addEventListener('input', () => { clearTimeout(tFiltro); tFiltro = setTimeout(cargar, 250); });
  tab.onclick = () => { showView('catalogo'); cargar(); };

  /* ---------- Ficha (lo que se enseña al cliente) y formulario ---------- */
  function mostrarInfo(it) {
    $('#catInfoDesc').textContent = it.descripcion;
    $('#catInfoPrecio').textContent = euro(it.precio);
    $('#catInfoCod').textContent = 'Código: ' + it.codigo;
    $('#catInfoEditar').onclick = () => { $('#dlgCatInfo').close(); abrirForm(it); };
    $('#dlgCatInfo').showModal();
  }
  $('#catInfoOtro').onclick = () => { $('#dlgCatInfo').close(); abrirEscaner(); };

  const f = $('#catForm');
  function abrirForm(it = {}, aviso = '') {
    f.reset();
    $('#catFormError').textContent = '';
    $('#catFormAviso').textContent = aviso;
    $('#catFormAviso').hidden = !aviso;
    $('#catFormTitulo').textContent = it.id ? 'Editar producto del catálogo' : 'Añadir al catálogo';
    $('#catBorrar').hidden = !it.id;
    f.elements.id.value = it.id || '';
    f.elements.codigo.value = it.codigo || '';
    f.elements.descripcion.value = it.descripcion || '';
    f.elements.precio.value = it.precio === null || it.precio === undefined ? ''
      : Number(it.precio).toLocaleString('es-ES', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    $('#dlgCatForm').showModal();
    (it.codigo ? f.elements.descripcion : f.elements.codigo).focus();
  }
  $('#catNuevo').onclick = () => abrirForm();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(f));
    try {
      await api('catalogo_guardar', {}, datos);
      $('#dlgCatForm').close();
      toast('Guardado en el catálogo');
      cargar();
      const r = await api('catalogo_buscar', {codigo: datos.codigo});
      if (r.encontrado) mostrarInfo(r.item);
    } catch (err) { $('#catFormError').textContent = err.message; }
  });
  $('#catBorrar').onclick = async () => {
    if (!confirm('¿Borrar este producto del catálogo? Solo se quita del catálogo, no del almacén.')) return;
    try {
      await api('catalogo_eliminar', {}, {id: f.elements.id.value});
      $('#dlgCatForm').close();
      toast('Borrado del catálogo');
      cargar();
    } catch (err) { $('#catFormError').textContent = err.message; }
  };

  async function buscarCodigo(codigo) {
    codigo = String(codigo).replace(/\s+/g, '');
    if (!codigo) return;
    try {
      const r = await api('catalogo_buscar', {codigo});
      if (r.encontrado) mostrarInfo(r.item);
      else abrirForm({codigo}, 'Este código todavía no está en el catálogo. Escribe la descripción y el precio y pulsa Guardar.');
    } catch (err) { toast(err.message); }
  }

  /* ---------- Cámara y lectura del código ---------- */
  let stream = null, detector = null, lector = null, buscando = false, leido = false;
  const estado = t => { $('#escEstado').textContent = t; };

  function cargarZXing() {
    if (window.ZXing) return Promise.resolve();
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = ZXING_URL; s.onload = ok;
      s.onerror = () => mal(new Error('No se pudo cargar el lector. Revisa la conexión a internet.'));
      document.head.appendChild(s);
    });
  }
  async function crearDetector() {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const quiero = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];
      const hay = await BarcodeDetector.getSupportedFormats();
      const formats = quiero.filter(x => hay.includes(x));
      return formats.length ? new BarcodeDetector({formats}) : null;
    } catch { return null; }
  }

  async function abrirEscaner() {
    leido = false;
    $('#escManual').reset();
    $('#dlgEscaner').showModal();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      estado('Este móvil o navegador no deja usar la cámara aquí. Escribe el código a mano.');
      return;
    }
    estado('Abriendo la cámara…');
    const video = $('#escVideo');
    try {
      detector = await crearDetector();
      if (detector) {
        stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
        video.srcObject = stream;
        await video.play();
        estado('Apunta la cámara al código de barras.');
        buscando = true;
        bucleDetector();
      } else {
        await cargarZXing();
        const Z = window.ZXing, hints = new Map();
        hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A,
          Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.ITF, Z.BarcodeFormat.QR_CODE]);
        lector = new Z.BrowserMultiFormatReader(hints, 300);
        estado('Apunta la cámara al código de barras.');
        await lector.decodeFromConstraints({video: {facingMode: {ideal: 'environment'}}, audio: false}, video, (res) => {
          if (res && !leido) encontrado(res.getText());
        });
      }
    } catch (e) {
      pararCamara();
      estado(e && e.name === 'NotAllowedError'
        ? 'No hay permiso para la cámara. Actívalo en los ajustes del navegador para esta app, o escribe el código a mano.'
        : (e && e.message && !e.name ? e.message : 'No se pudo abrir la cámara. Escribe el código a mano.'));
    }
  }
  async function bucleDetector() {
    const video = $('#escVideo');
    while (buscando && !leido) {
      try {
        if (video.readyState >= 2) {
          const r = await detector.detect(video);
          if (r && r.length) { encontrado(r[0].rawValue); break; }
        }
      } catch { /* fotograma sin leer: se sigue intentando */ }
      await new Promise(ok => setTimeout(ok, 180));
    }
  }
  function encontrado(codigo) {
    if (leido) return;
    leido = true;
    if (navigator.vibrate) navigator.vibrate(80);
    pararCamara();
    $('#dlgEscaner').close();
    buscarCodigo(codigo);
  }
  function pararCamara() {
    buscando = false;
    if (lector) { try { lector.reset(); } catch {} lector = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const v = $('#escVideo'); if (v) v.srcObject = null;
  }
  $('#catEscanear').onclick = abrirEscaner;
  $('#escCerrar').onclick = () => $('#dlgEscaner').close();
  $('#dlgEscaner').addEventListener('close', pararCamara);
  $('#escManual').addEventListener('submit', e => {
    e.preventDefault();
    const c = e.target.elements.codigo.value.trim();
    if (!c) return;
    leido = true; pararCamara(); $('#dlgEscaner').close();
    buscarCodigo(c);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && $('#dlgEscaner').open) $('#dlgEscaner').close(); });
})();
