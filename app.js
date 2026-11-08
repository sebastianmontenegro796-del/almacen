'use strict';

/* =========================================================
   Seba Almacén — app móvil (PWA)
   - Encuentra la dirección actual del túnel en ntfy
   - Inicia sesión con token (se guarda en el teléfono)
   - Usa la misma API que la web (api.php)
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => { const v = Number(n); return Number.isInteger(v) ? String(v) : v.toLocaleString('es-ES', {maximumFractionDigits: 2}); };
const isLow = p => Number(p.stock_minimo) > 0 && Number(p.cantidad) <= Number(p.stock_minimo);

/* ---------- Unidades (Palé, Medio palé, Fila, Caja, Unidad) ---------- */
const UNIDADES = {'Palé': ['palé', 'palés'], 'Medio palé': ['medio palé', 'medios palés'],
                  'Fila': ['fila', 'filas'], 'Caja': ['caja', 'cajas'], 'Unidad': ['unidad', 'unidades']};
const ALIAS_UD = {pale: 'Palé', pales: 'Palé', palet: 'Palé', palets: 'Palé',
                  'medio pale': 'Medio palé', 'medios pales': 'Medio palé', 'medio palet': 'Medio palé',
                  fila: 'Fila', filas: 'Fila', caja: 'Caja', cajas: 'Caja',
                  unidad: 'Unidad', unidades: 'Unidad', ud: 'Unidad', uds: 'Unidad', und: 'Unidad', u: 'Unidad'};
// Devuelve una de las 5 unidades, o null si es un valor antiguo que no encaja (p. ej. "tarros")
const unidadNorm = u => ALIAS_UD[String(u ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()] || null;
// "2 palés", "1 medio palé", "12 cajas"… (los valores antiguos se muestran tal cual)
function cantUd(n, u) {
  const c = unidadNorm(u);
  if (!c) return `${fmt(n)} ${u || ''}`.trim();
  return `${fmt(n)} ${UNIDADES[c][Math.abs(Number(n)) === 1 ? 0 : 1]}`;
}
// Selecciona la unidad en el desplegable; si es un valor antiguo, lo conserva como opción extra
function ponerUnidad(sel, u) {
  sel.querySelectorAll('option[data-antigua]').forEach(o => o.remove());
  const c = u ? unidadNorm(u) : 'Unidad';
  if (c) { sel.value = c; return; }
  const o = new Option(`${u} (actual)`, u);
  o.dataset.antigua = '1';
  sel.add(o);
  sel.value = u;
}

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

const TOPIC = (window.SEBA_CONFIG || {}).topic;
const API_PATH = '/seba_almacen/api.php';
const TUNEL_RE = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;

let base = ls.get('seba_base');     // p. ej. https://xxxx.trycloudflare.com
let token = ls.get('seba_token');

/* ---------- Pantallas ---------- */
function pantalla(id) {
  for (const p of ['pantallaEstado', 'pantallaLogin', 'pantallaApp']) $('#' + p).hidden = p !== id;
}
function estado(texto, error = false) {
  pantalla('pantallaEstado');
  $('#estadoTexto').textContent = texto;
  $('#estadoTexto').className = error ? 'error' : 'muted';
  $('#spinner').hidden = error;
  $('#btnReintentar').hidden = !error;
}

/* ---------- Encontrar el servidor ---------- */
async function fetchTimeout(url, opt = {}, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, {...opt, signal: ctl.signal, cache: 'no-store'}); }
  finally { clearTimeout(t); }
}

async function ping(b) {
  try {
    const r = await fetchTimeout(b + API_PATH + '?action=ping', {}, 8000);
    const j = await r.json();
    return j && j.app === 'seba_almacen';
  } catch { return false; }
}

async function candidatosNtfy() {
  const urls = [];
  for (const t of [TOPIC + '-url', TOPIC]) {
    try {
      const r = await fetchTimeout(`https://ntfy.sh/${encodeURIComponent(t)}/json?poll=1&since=all`);
      const lineas = (await r.text()).trim().split('\n').filter(Boolean);
      const msgs = lineas.map(l => { try { return JSON.parse(l); } catch { return null; } })
                         .filter(m => m && m.event === 'message')
                         .sort((a, b) => b.time - a.time);
      for (const m of msgs) {
        const u = (t === TOPIC ? (m.click || '') : (m.message || '')).trim().replace(/\/seba_almacen\/?$/, '').replace(/\/$/, '');
        if (TUNEL_RE.test(u) && !urls.includes(u)) urls.push(u);
      }
    } catch { /* sin conexión con ntfy */ }
    if (urls.length) break;
  }
  return urls;
}

async function buscarServidor(forzar = false) {
  // 1) Abierta desde la propia PC o la Wi-Fi (pruebas): mismo origen
  if (location.pathname.includes('/seba_almacen/') && await ping(location.origin)) return location.origin;
  // 2) Última dirección conocida
  if (!forzar && base && await ping(base)) return base;
  // 3) Dirección publicada en ntfy
  for (const u of await candidatosNtfy()) {
    if (await ping(u)) return u;
  }
  return null;
}

async function conectar(forzar = false) {
  estado('Buscando el servidor…');
  const b = await buscarServidor(forzar);
  if (!b) {
    estado('No se encuentra el servidor. Comprueba que la PC del almacén está encendida y con internet.', true);
    return false;
  }
  base = b; ls.set('seba_base', b);
  return true;
}

/* ---------- API ---------- */
async function api(action, params = {}, body = null, reintento = true) {
  const qs = new URLSearchParams({action, ...params});
  const headers = {};
  if (token) headers['X-Auth-Token'] = token;
  if (body) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetchTimeout(base + API_PATH + '?' + qs, body ? {method: 'POST', headers, body: JSON.stringify(body)} : {headers}, 15000);
  } catch (e) {
    // La dirección pudo cambiar: buscar la nueva y reintentar una vez
    if (reintento && await conectar(true)) { pantalla('pantallaApp'); return api(action, params, body, false); }
    throw new Error('Sin conexión con el servidor');
  }
  if (r.status === 401 && action !== 'login') { cerrarSesionLocal(); throw new Error('Sesión caducada'); }
  const data = await r.json().catch(() => ({error: 'Respuesta no válida del servidor'}));
  if (!r.ok || data.error) throw new Error(data.error || 'Error ' + r.status);
  return data;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- Sesión ---------- */
function cerrarSesionLocal() {
  token = null; ls.set('seba_token', null);
  pantalla('pantallaLogin');
}
$('#formLogin').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  $('#errLogin').textContent = '';
  try {
    const r = await api('login', {}, {usuario: f.elements.usuario.value.trim(), clave: f.elements.clave.value});
    token = r.token; ls.set('seba_token', token);
    f.reset();
    iniciarApp();
  } catch (err) { $('#errLogin').textContent = err.message; }
});
$('#btnSalir').onclick = async () => {
  if (!confirm('¿Cerrar sesión en este teléfono?')) return;
  try { await api('logout', {}, {}); } catch {}
  cerrarSesionLocal();
};
$('#btnReintentar').onclick = () => arrancar(true);

/* ---------- Estado de la interfaz ---------- */
let ubicaciones = [];
let selected = null;

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showView(b.dataset.view));
function showView(v) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  if (v === 'productos') loadProductos();
  if (v === 'movimientos') loadMovimientos();
}

/* ---------- Resumen ---------- */
async function loadStats() {
  const s = await api('resumen');
  $('#stats').innerHTML = `
    <div class="stat"><b>${s.productos}</b><span>Productos</span></div>
    <div class="stat"><b>${s.ocupadas}/${s.ubicaciones}</b><span>Ocupadas</span></div>
    <div class="stat ${s.bajo_stock ? 'alerta' : ''}"><b>${s.bajo_stock}</b><span>Stock bajo</span></div>
    <div class="stat"><b>${s.mov_hoy}</b><span>Mov. hoy</span></div>`;
}

/* ---------- Mapa ---------- */
async function loadMapa() {
  ubicaciones = await api('ubicaciones');
  const grid = $('#grid');
  grid.querySelectorAll('.shelf').forEach(e => e.remove());
  ubicaciones.forEach(u => {
    const d = document.createElement('div');
    d.className = 'shelf' + (u.vertical ? ' vertical' : '') + (u.bajo_stock ? ' alerta' : u.num_productos ? ' ocupado' : '') + (u.codigo === selected ? ' sel' : '');
    d.dataset.codigo = u.codigo;
    Object.assign(d.style, {left: u.pos_left + '%', top: u.pos_top + '%', width: u.pos_w + '%', height: u.pos_h + '%'});
    d.innerHTML = `<h3>${esc(u.codigo)}</h3><div class="count">${u.num_productos ? u.num_productos + ' prod.' : ''}</div>`;
    d.onclick = () => showDetail(u.codigo);
    grid.appendChild(d);
  });
  $('#selUbic').innerHTML = '<option value="">— Sin ubicación —</option>' +
    ubicaciones.map(u => `<option value="${esc(u.codigo)}">${esc(u.codigo)} — ${esc(u.etiqueta)}</option>`).join('');
  if (vista === '3d') ponerVista('3d');
}

/* ---------- Vista 3D ---------- */
let vista = '2d';
try { vista = localStorage.getItem('seba_vista') || '2d'; } catch (e) {}
async function ponerVista(v) {
  vista = v;
  try { localStorage.setItem('seba_vista', v); } catch (e) {}
  document.querySelectorAll('.vista-toggle button').forEach(b => b.classList.toggle('on', b.dataset.vista === v));
  $('#grid').hidden = v === '3d';
  $('#plano3d').hidden = v !== '3d';
  if (v !== '3d') { if (window.Mapa3D) Mapa3D.ocultar(); return; }
  const carga = $('#plano3d .p3d-carga');
  try {
    await Mapa3D.mostrar($('#plano3d'), ubicaciones, {selected, onSelect: c => showDetail(c, false)});
    carga.hidden = true;
  } catch (err) {
    carga.hidden = false;
    carga.textContent = err.message;
  }
}
document.querySelectorAll('.vista-toggle button').forEach(b => b.onclick = () => ponerVista(b.dataset.vista));
document.querySelectorAll('[data-p3d]').forEach(b => b.onclick = () => {
  const girando = Mapa3D.accion(b.dataset.p3d);
  $('[data-p3d="girar"]').classList.toggle('on', !!girando);
});

async function showDetail(codigo, scroll = true) {
  selected = codigo;
  document.querySelectorAll('.shelf').forEach(e => e.classList.toggle('sel', e.dataset.codigo === codigo));
  if (window.Mapa3D) Mapa3D.seleccionar(codigo);
  const u = await api('ubicacion', {codigo});
  const det = $('#detail');
  det.innerHTML = `
    <div class="head">
      <div><h2>${esc(u.codigo)} — ${esc(u.etiqueta)}</h2>
      <span class="muted">${u.productos.length} producto(s)</span></div>
      <button class="btn link" id="btnRenombrar" title="Renombrar">✏️</button>
    </div>
    ${u.productos.length ? '' : '<p class="muted">Esta ubicación está vacía.</p>'}
    ${u.productos.map(p => `
      <div class="item">
        <div class="name">${esc(p.nombre)}</div>
        <div class="qty ${isLow(p) ? 'low' : ''}">${esc(cantUd(p.cantidad, p.unidad))}${p.referencia ? ' · Ref ' + esc(p.referencia) : ''}${isLow(p) ? ' · stock bajo' : ''}</div>
        ${p.notas ? `<div class="muted" style="font-size:.85rem">${esc(p.notas)}</div>` : ''}
        <div class="btns">
          <button class="btn sm ok" data-mov="ENTRADA" data-id="${p.id}">+ Entrada</button>
          <button class="btn sm danger" data-mov="SALIDA" data-id="${p.id}">− Salida</button>
          <button class="btn sm" data-edit="${p.id}">Editar / mover</button>
        </div>
      </div>`).join('')}
    <button class="btn primary ancho" id="btnAddHere">+ Añadir producto aquí</button>`;
  det._productos = u.productos;
  $('#btnAddHere').onclick = () => openProducto({ubicacion: codigo});
  $('#btnRenombrar').onclick = () => openUbic(u);
  if (scroll && window.innerWidth <= 860) det.scrollIntoView({behavior: 'smooth', block: 'start'});
}

$('#detail').addEventListener('click', e => {
  const prods = $('#detail')._productos || [];
  const m = e.target.closest('[data-mov]');
  if (m) return openMov(prods.find(p => p.id == m.dataset.id), m.dataset.mov);
  const ed = e.target.closest('[data-edit]');
  if (ed) openProducto(prods.find(p => p.id == ed.dataset.edit));
});

/* ---------- Búsqueda ---------- */
let searchTimer;
$('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = $('#search').value.trim();
    const box = $('#results');
    if (!q) { box.innerHTML = ''; return; }
    const lista = await api('productos', {q});
    const ubicMatch = ubicaciones.filter(u => (u.codigo + ' ' + u.etiqueta).toLowerCase().includes(q.toLowerCase()));
    if (!lista.length && !ubicMatch.length) { box.innerHTML = '<div class="muted" style="padding:8px 4px">Sin resultados</div>'; return; }
    box.innerHTML =
      ubicMatch.slice(0, 5).map(u => `<div class="res" data-go="${esc(u.codigo)}"><strong>${esc(u.codigo)}</strong> — ${esc(u.etiqueta)}</div>`).join('') +
      lista.slice(0, 15).map(p => `<div class="res" data-go="${esc(p.ubicacion || '')}"><strong>${esc(p.ubicacion || 'Sin ubicación')}</strong> — ${esc(p.nombre)} <span class="muted">(${esc(cantUd(p.cantidad, p.unidad))})</span></div>`).join('');
  }, 250);
});
$('#results').addEventListener('click', e => {
  const r = e.target.closest('[data-go]');
  if (!r || !r.dataset.go) return;
  const el = document.querySelector(`.shelf[data-codigo="${CSS.escape(r.dataset.go)}"]`);
  if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); el.scrollIntoView({behavior: 'smooth', block: 'center'}); }
  $('#results').innerHTML = ''; $('#search').value = '';
  showDetail(r.dataset.go, false);
});

/* ---------- Productos ---------- */
let filtroTimer, listaProductos = [];
$('#filtro').addEventListener('input', () => { clearTimeout(filtroTimer); filtroTimer = setTimeout(loadProductos, 250); });
$('#btnNuevo').onclick = () => openProducto({});
async function loadProductos() {
  listaProductos = await api('productos', {q: $('#filtro').value.trim()});
  $('#tablaProductos').innerHTML = listaProductos.length ? listaProductos.map(p => `
    <tr>
      <td class="wrap">${esc(p.nombre)}${p.referencia ? `<br><span class="muted" style="font-size:.8rem">Ref ${esc(p.referencia)}</span>` : ''}</td>
      <td class="${isLow(p) ? 'low' : ''}">${esc(cantUd(p.cantidad, p.unidad))}</td>
      <td>${p.ubicacion ? `<span class="tag">${esc(p.ubicacion)}</span>` : '<span class="muted">—</span>'}</td>
      <td style="text-align:right">
        <button class="btn sm ok" data-mov="ENTRADA" data-id="${p.id}">+</button>
        <button class="btn sm danger" data-mov="SALIDA" data-id="${p.id}">−</button>
        <button class="btn sm" data-edit="${p.id}">✏️</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="4" class="muted">No hay productos.</td></tr>';
}
$('#tablaProductos').addEventListener('click', e => {
  const m = e.target.closest('[data-mov]');
  if (m) return openMov(listaProductos.find(p => p.id == m.dataset.id), m.dataset.mov);
  const ed = e.target.closest('[data-edit]');
  if (ed) openProducto(listaProductos.find(p => p.id == ed.dataset.edit));
});

/* ---------- Movimientos ---------- */
async function loadMovimientos() {
  const lista = await api('movimientos');
  $('#tablaMov').innerHTML = lista.length ? lista.map(m => {
    const ub = m.tipo === 'TRASLADO' ? `${esc(m.origen || '—')} → ${esc(m.destino || '—')}` : esc(m.destino || m.origen || '—');
    const sign = m.tipo === 'SALIDA' ? '−' : (m.tipo === 'ENTRADA' || m.tipo === 'ALTA') ? '+' : '';
    return `<tr>
      <td>${new Date(m.fecha.replace(' ', 'T')).toLocaleString('es-ES', {dateStyle: 'short', timeStyle: 'short'})}</td>
      <td class="wrap">${esc(m.nombre || '(eliminado)')}</td>
      <td><span class="tag ${esc(m.tipo)}">${esc(m.tipo)}</span></td>
      <td>${sign}${esc(cantUd(m.cantidad, m.unidad))}</td>
      <td>${ub}</td>
      <td class="wrap">${esc(m.nota || '')}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="muted">Sin movimientos todavía.</td></tr>';
}

/* ---------- Modales ---------- */
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());

const fP = $('#formProducto');
function openProducto(p = {}) {
  fP.reset();
  $('#errProducto').textContent = '';
  $('#dlgTitulo').textContent = p.id ? 'Editar producto' : 'Nuevo producto';
  $('#btnEliminar').style.display = p.id ? '' : 'none';
  for (const k of ['id', 'nombre', 'referencia', 'cantidad', 'stock_minimo', 'ubicacion', 'notas']) {
    if (p[k] !== undefined && p[k] !== null) fP.elements[k].value = (k === 'cantidad' || k === 'stock_minimo') ? Number(p[k]) : p[k];
  }
  ponerUnidad(fP.elements.unidad, p.unidad);
  if (!p.id) fP.elements.id.value = '';
  $('#dlgProducto').showModal();
}
fP.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('producto_guardar', {}, Object.fromEntries(new FormData(fP)));
    $('#dlgProducto').close();
    toast('Producto guardado');
    refresh();
  } catch (err) { $('#errProducto').textContent = err.message; }
});
$('#btnEliminar').onclick = async () => {
  if (!confirm('¿Eliminar este producto y su historial? No se puede deshacer.')) return;
  try {
    await api('producto_eliminar', {}, {id: fP.elements.id.value});
    $('#dlgProducto').close();
    toast('Producto eliminado');
    refresh();
  } catch (err) { $('#errProducto').textContent = err.message; }
};

const fM = $('#formMov');
function openMov(p, tipo) {
  if (!p) return;
  fM.reset();
  $('#errMov').textContent = '';
  fM.elements.id.value = p.id;
  fM.elements.tipo.value = tipo;
  $('#movTitulo').textContent = (tipo === 'ENTRADA' ? 'Entrada de ' : 'Salida de ') + p.nombre;
  $('#movInfo').textContent = `Stock actual: ${cantUd(p.cantidad, p.unidad)}${p.ubicacion ? ' · ' + p.ubicacion : ''}`;
  $('#dlgMov').showModal();
}
fM.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('movimiento', {}, Object.fromEntries(new FormData(fM)));
    $('#dlgMov').close();
    toast('Movimiento registrado');
    refresh();
  } catch (err) { $('#errMov').textContent = err.message; }
});

const fU = $('#formUbic');
function openUbic(u) {
  fU.elements.codigo.value = u.codigo;
  fU.elements.etiqueta.value = u.etiqueta;
  $('#dlgUbic').showModal();
}
fU.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('ubicacion_guardar', {}, Object.fromEntries(new FormData(fU)));
    $('#dlgUbic').close();
    refresh();
  } catch (err) { alert(err.message); }
});

/* ---------- Arranque ---------- */
async function refresh() {
  await Promise.all([loadStats(), loadMapa()]);
  if (selected) showDetail(selected, false);
  if ($('#view-productos').classList.contains('active')) loadProductos();
  if ($('#view-movimientos').classList.contains('active')) loadMovimientos();
}

async function iniciarApp() {
  pantalla('pantallaApp');
  try {
    await refresh();
    if (!selected && ubicaciones.some(u => u.codigo === 'F4')) showDetail('F4', false);
  } catch (err) {
    if (err.message !== 'Sesión caducada') estado(err.message, true);
  }
}

async function arrancar(forzar = false) {
  if (!(await conectar(forzar))) return;
  if (!token) { pantalla('pantallaLogin'); return; }
  iniciarApp();
}

// Al volver a la app tras un rato, refrescar datos (y buscar el servidor si cambió)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && token && !$('#pantallaApp').hidden) refresh().catch(() => {});
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
arrancar();
