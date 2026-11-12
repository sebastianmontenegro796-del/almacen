/* Vista 3D interactiva del almacén (Three.js).
   Uso: await Mapa3D.mostrar(contenedor, ubicaciones, {selected, onSelect})
        Mapa3D.actualizar(ubicaciones, selected) · Mapa3D.seleccionar(codigo) · Mapa3D.ocultar()
   Los muebles salen de window.ALMACEN_LAYOUT (almacen-layout.js, el plano del Modelador, en metros).
   Las ubicaciones se colocan con sus pos_left/top/w/h (% de la nave), igual que en el plano 2D. */
(function () {
  const URLS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
                'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
  const LAYOUT = window.ALMACEN_LAYOUT || {nave: {ancho: 30, fondo: 40}, modulos: []};
  const W = LAYOUT.nave.ancho, D = LAYOUT.nave.fondo, K = Math.max(W, D);
  // mismas vistas que el Modelador
  const VISTA_INICIAL = {pos: [-K * .35, K * .75, K * 1.05], target: [0, 0, 0]};
  const VISTA_ARRIBA = {pos: [0, K * 1.55, 0.01], target: [0, 0, 0]};
  const MOD = id => LAYOUT.modulos.find(m => m.id === id);
  // Altura (y0, y1 en metros) de cada ubicación: arriba / medio en los bordes, la estantería entera en el resto
  function rangoY(cod) {
    const arriba = m => m ? [m.alto - .1, m.alto + 1.1] : [0, 1.5];
    const rk = MOD('b2'), hN = rk ? rk.alto / rk.baldas : 1;
    // medio = solo la fila justo debajo de la de arriba (no las de más abajo)
    if (/^F\d+M$/.test(cod)) return rk ? [(rk.baldas - 2) * hN, (rk.baldas - 1) * hN] : [0, 1.5];
    if (/^F\d+$/.test(cod)) return rk ? [(rk.baldas - 1) * hN, rk.alto + .3] : [0, 1.5];
    if (/^I\d+$/.test(cod)) return arriba(MOD('a'));
    if (/^D\d+$/.test(cod)) return arriba(MOD('d'));
    const est = {EST1: 'c1', EST2: 'c1', EST3: 'c2', EST4: 'c2', EST5: 'c3', EST6: 'c3'}[cod];
    if (est) { const m = MOD(est); return [0, m ? m.alto : 2]; }
    if (/^E\d+$/.test(cod)) { const m = MOD('mmwbdi9lz1yd'); return [0, m ? m.alto : 2]; }
    return [0, 1.4];
  }
  function oscuro() { return matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light'; }

  let cargando = null;
  let el, renderer, scene, camera, controls, ubicsGrupo, muebles, raycaster, puntero;
  let items = {};           // codigo -> {grupo, hit, borde, etiqueta}
  let selected = null, onSelect = null;
  let animaciones = [];
  let camTween = null, activo = false, ultimoDatos = '', introHasta = 0;

  /* ---------- Carga de la librería ---------- */
  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok;
      s.onerror = () => mal(new Error('No se pudo cargar la vista 3D. Revisa la conexión a internet.'));
      document.head.appendChild(s);
    });
  }
  function cargar() {
    if (!cargando) {
      cargando = (async () => {
        if (!window.THREE) await cargarScript(URLS[0]);
        if (!THREE.OrbitControls) await cargarScript(URLS[1]);
      })();
      cargando.catch(() => { cargando = null; });
    }
    return cargando;
  }

  /* ---------- Utilidades ---------- */
  const css = (n, def) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || def;
  const ahora = () => performance.now();
  const easeOutBack = t => { const c = 1.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function colores() {
    return {
      bg: css('--bg', '#0f172a'), card: css('--card', '#1e293b'), borde: css('--border', '#334155'),
      texto: css('--text', '#e2e8f0'), muted: css('--muted', '#94a3b8'), accent: css('--accent', '#38bdf8'),
      ok: css('--ok', '#4ade80'), warn: css('--warn', '#f87171')
    };
  }
  function pos(u) {
    const w = u.pos_w / 100 * W, d = u.pos_h / 100 * D;
    return {x: u.pos_left / 100 * W - W / 2 + w / 2, z: u.pos_top / 100 * D - D / 2 + d / 2, w, d};
  }
  function liberar(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  function etiqueta(texto, sub, C, resaltada, colorBorde, fija) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = resaltada ? C.accent : 'rgba(15,23,42,.85)';
    g.strokeStyle = resaltada ? C.accent : (colorBorde || C.borde);
    g.lineWidth = colorBorde ? 8 : 4;
    const r = 26, x = 8, y = 14, w = 240, h = sub ? 100 : 76;
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = resaltada ? '#0f172a' : (colorBorde || C.accent);
    g.font = 'bold 54px Segoe UI, Roboto, sans-serif';
    g.fillText(texto, 128, y + (sub ? 36 : h / 2 + 2));
    if (sub) {
      g.fillStyle = resaltada ? '#0f172a' : '#e2e8f0';
      g.font = '600 30px Segoe UI, Roboto, sans-serif';
      g.fillText(sub, 128, y + 78);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, depthTest: false, transparent: true, sizeAttenuation: !fija}));
    s.renderOrder = 10;
    return s;
  }

  /* ---------- Muebles (los mismos modelos que el Modelador) ---------- */
  function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; s = s || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const CARTON = ['#c9a36b', '#bf9659', '#d4b07a', '#b8915a', '#e0c08e'];
  const PRODUCTOS = ['#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#0891b2', '#facc15', '#ea580c', '#f8fafc', '#65a30d', '#be123c'];
  const BEBIDA = [['#dc2626', '#b91c1c'], ['#15803d', '#166534'], ['#2563eb', '#60a5fa'], ['#f59e0b', '#ea580c'], ['#e5e7eb', '#cbd5e1'], ['#be123c', '#f43f5e']];
  const BEBIDAS = ['#3b1a10', '#3b1a10', '#dc2626', '#dc2626', '#111827', '#f59e0b', '#16a34a', '#e5e7eb'];
  const MADERA = ['#c49a6c', '#b58b5c', '#a87b4f'];
  const EC = .5, EC_ALTO = 1.6;

  function Lote() { this.b = []; }
  Lote.prototype.box = function (cx, y0, cz, w, h, d, col) { if (w > 0 && h > 0 && d > 0) this.b.push([cx, y0 + h / 2, cz, w, h, d, col]); };

  function pale(L, cx, y0, cz, largoEnZ, carga, alto, r) {
    const box = (a, y, b, sa, h, sb, c) => largoEnZ ? L.box(cx + b, y0 + y, cz + a, sb, h, sa, c) : L.box(cx + a, y0 + y, cz + b, sa, h, sb, c);
    const mad = pick(r, MADERA), mad2 = '#9c7146';
    for (const b of [-.35, 0, .35]) box(0, 0, b, 1.2, .022, b ? .1 : .145, mad2);
    for (const a of [-.5275, 0, .5275]) for (const b of [-.3275, 0, .3275]) box(a, .022, b, .145, .078, .145, mad2);
    for (const a of [-.5275, 0, .5275]) box(a, .1, 0, .145, .022, .8, mad);
    for (const b of [-.35, -.175, 0, .175, .35]) box(0, .122, b, 1.2, .022, .1, mad);
    if (carga === 'vacio' || alto <= 0.05) return;
    const capas = Math.max(1, Math.round(alto / (carga === 'bebida' ? .26 : .32))), hc = alto / capas, par = pick(r, BEBIDA);
    for (let k = 0; k < capas; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
      box(-.4 + i * .4, .144 + k * hc, -.2 + j * .4, .39, hc - .012, .39, carga === 'bebida' ? par[(i + j + k) % 2] : pick(r, CARTON));
  }
  const caras = md => md.doble ? [[0, md.fondo / 2, 1], [-md.fondo / 2, 0, -1]] : [[-md.fondo / 2, md.fondo / 2, 1]];
  function niveles(n, y0, y1) { const a = []; for (let k = 0; k < n; k++) a.push(n === 1 ? y0 : y0 + k * (y1 - y0) / (n - 1)); return a; }

  function gondola(md, L, r) {
    const Lt = md.huecos * md.ancho, H = md.alto, F = md.fondo;
    L.box(0, 0, 0, Lt, .12, F, '#475569');
    const zP = md.doble ? 0 : -F / 2 + .02;
    L.box(0, .12, zP, Lt, H - .12, .03, '#cbd5e1');
    L.box(0, H - .08, zP, Lt, .08, .06, '#94a3b8');
    for (let i = 0; i <= md.huecos; i++) L.box(-Lt / 2 + i * md.ancho, 0, zP, .05, H, .06, '#334155');
    const alturas = [0.12].concat(niveles(Math.max(1, md.baldas), .42, H - .4));
    for (const [z0, z1, s] of caras(md)) {
      const zIn = s > 0 ? Math.max(z0, zP + .02) : z0, zOut = s > 0 ? z1 : Math.min(z1, zP - .02);
      const d = Math.abs(zOut - zIn) - .03, zc = (zIn + zOut) / 2, zF = s > 0 ? zOut : zIn;
      alturas.forEach((y, k) => {
        const sig = k + 1 < alturas.length ? alturas[k + 1] : H - .1;
        for (let i = 0; i < md.huecos; i++) {
          const x0 = -Lt / 2 + i * md.ancho;
          if (k > 0) { L.box(x0 + md.ancho / 2, y, zc, md.ancho - .04, .025, d, '#f1f5f9'); L.box(x0 + md.ancho / 2, y - .02, zF, md.ancho - .04, .045, .012, '#94a3b8'); }
          if (!md.productos) continue;
          const yb = y + (k > 0 ? .025 : 0), hueco = sig - yb - .05;
          let x = x0 + .04;
          while (x < x0 + md.ancho - .1) {
            const w = .07 + r() * .2; if (x + w > x0 + md.ancho - .03) break;
            if (r() > .1) L.box(x + w / 2, yb, zc, w - .01, Math.min(hueco, (k === 0 ? .2 : .1) + r() * .22), d * (.7 + r() * .25), k === 0 ? pick(r, CARTON) : pick(r, PRODUCTOS));
            x += w;
          }
        }
      });
    }
  }
  function metalica(md, L, r) {
    const Lt = md.huecos * md.ancho, H = md.alto, n = Math.max(1, md.baldas);
    const yIni = md.palesSuelo > 0 ? Math.max(.25, .144 + md.cargaAlto + .2) : .12;
    const alturas = niveles(n, Math.min(yIni, H - .1), H - .06);
    for (const [z0, z1, s] of caras(md)) {
      const zc = (z0 + z1) / 2, d = z1 - z0, zPal = s > 0 ? z0 + .6 : z1 - .6;
      for (let i = 0; i <= md.huecos; i++) {
        const x = -Lt / 2 + i * md.ancho;
        for (const z of [z0 + .03, z1 - .03]) L.box(x, 0, z, .07, H, .05, '#e5e7eb');
        for (let y = .3; y < H; y += .7) L.box(x, y, zc, .03, .03, d - .06, '#cbd5e1');
      }
      alturas.forEach((y, k) => {
        for (let i = 0; i < md.huecos; i++) {
          const xc = -Lt / 2 + (i + .5) * md.ancho;
          for (const z of [z0 + .03, z1 - .03]) L.box(xc, y - .08, z, md.ancho - .07, .08, .045, '#ea580c');
          L.box(xc, y, zc, md.ancho - .08, .018, d - .07, '#d6b98c');
          const ultima = k === alturas.length - 1, sig = ultima ? H + 1.1 : alturas[k + 1] - .1;
          if (ultima && md.arriba) {
            let x = xc - md.ancho / 2 + .06;
            while (x < xc + md.ancho / 2 - .3) { const w = .3 + r() * .35; if (x + w > xc + md.ancho / 2 - .04) break;
              L.box(x + w / 2, y + .018, zc, w - .02, .35 + r() * .7, Math.min(d - .1, .3 + r() * .4), pick(r, CARTON)); x += w; }
          } else if (!ultima && md.productos) {
            let x = xc - md.ancho / 2 + .05;
            while (x < xc + md.ancho / 2 - .12) { const w = .12 + r() * .35; if (x + w > xc + md.ancho / 2 - .04) break;
              if (r() > .15) L.box(x + w / 2, y + .018, zc, w - .02, Math.min(sig - y - .06, .15 + r() * .35), (d - .1) * (.6 + r() * .35), r() > .45 ? pick(r, CARTON) : pick(r, PRODUCTOS));
              x += w; }
          }
        }
      });
      if (md.palesSuelo > 0) for (let i = 0; i < md.huecos; i++) {
        const x0 = -Lt / 2 + i * md.ancho, paso = md.ancho / md.palesSuelo;
        for (let p = 0; p < md.palesSuelo; p++) pale(L, x0 + paso * (p + .5), 0, zPal, true, md.carga, md.cargaAlto, r);
      }
    }
  }
  function rack(md, L, r) {
    const Lt = md.huecos * md.ancho, H = md.alto, n = Math.max(1, md.baldas), hN = H / n;
    for (const [z0, z1, s] of caras(md)) {
      const zc = (z0 + z1) / 2, d = z1 - z0, zPal = s > 0 ? z0 + .6 : z1 - .6;
      for (let i = 0; i <= md.huecos; i++) {
        const x = -Lt / 2 + i * md.ancho;
        for (const z of [z0 + .05, z1 - .05]) L.box(x, 0, z, .09, H, .08, '#1d4ed8');
        for (let y = .4; y < H; y += .9) L.box(x, y, zc, .04, .04, d - .1, '#3b82f6');
      }
      for (let k = 0; k < n; k++) {
        const y = k * hN;
        for (let i = 0; i < md.huecos; i++) {
          const xc = -Lt / 2 + (i + .5) * md.ancho;
          if (k > 0) for (const z of [z0 + .05, z1 - .05]) L.box(xc, y - .12, z, md.ancho - .09, .12, .05, '#ea580c');
          const ultimo = k === n - 1;
          if (ultimo && !md.arriba) continue;
          const alto = Math.max(0, Math.min(md.cargaAlto, (ultimo ? 1.2 : hN - .3) - .144)), paso = md.ancho / md.palesHueco;
          for (let p = 0; p < md.palesHueco; p++) pale(L, xc - md.ancho / 2 + paso * (p + .5), y, zPal, true, md.carga, alto, r);
        }
      }
    }
  }
  function cabeceros(md, L, r) {
    const ext = (md.tipo === 'gondola' || md.tipo === 'metalica') ? ({ambos: [-1, 1], inicio: [-1], fin: [1]}[md.cabeceros] || []) : [];
    const Lt = md.huecos * md.ancho, F = md.fondo;
    for (const s of ext) {
      const xB = s * Lt / 2, xc = xB + s * EC / 2, H = EC_ALTO;
      L.box(xc, 0, 0, EC, .1, F, '#475569');
      L.box(xB + s * .025, .1, 0, .03, H - .1, F, '#cbd5e1');
      L.box(xc, H - .16, 0, EC, .16, F, '#e11d48');
      niveles(4, .35, H - .45).forEach(y => {
        L.box(xc, y, 0, EC - .05, .025, F - .06, '#f1f5f9');
        let z = -F / 2 + .05;
        while (z < F / 2 - .1) { const w = .08 + r() * .16; if (z + w > F / 2 - .04) break;
          if (r() > .08) L.box(xc + s * .02, y + .025, z + w / 2, (EC - .14) * (.7 + r() * .3), Math.min(.3, .1 + r() * .2), w - .01, pick(r, PRODUCTOS));
          z += w; }
      });
    }
  }
  function nevera(md, L, r) {
    const Lt = md.huecos * md.ancho, F = md.fondo, H = md.alto, rojo = '#c8102e', marco = '#e5e7eb';
    L.box(0, 0, 0, Lt, .12, F, '#7f1d1d');
    L.box(0, .12, -F / 2 + .03, Lt, H - .12, .06, rojo);
    for (const x of [-Lt / 2 + .03, Lt / 2 - .03]) L.box(x, .12, 0, .06, H - .12, F, rojo);
    L.box(0, H - .3, 0, Lt, .3, F, rojo);
    L.box(0, H - .2, F / 2 + .006, Lt * .86, .07, .012, '#ffffff');
    L.box(0, .12, -F / 2 + .065, Lt - .12, H - .45, .012, '#f8fafc');
    L.box(0, .12, F / 2 - .02, Lt, .05, .04, marco);
    L.box(0, H - .35, F / 2 - .02, Lt, .05, .04, marco);
    for (let i = 0; i <= md.huecos; i++) L.box(-Lt / 2 + i * md.ancho, .12, F / 2 - .02, .05, H - .45, .04, marco);
    niveles(Math.max(1, md.baldas), .22, H - .62).forEach((y, k) => {
      L.box(0, y, 0, Lt - .12, .02, F - .14, '#cbd5e1');
      if (!md.productos) return;
      const lata = k % 2 === 1, h = lata ? .12 : .25, paso = lata ? .075 : .085;
      for (const z of [F / 2 - .14, F / 2 - .24, F / 2 - .34]) {
        const col = pick(r, BEBIDAS);
        for (let x = -Lt / 2 + .1; x < Lt / 2 - .1; x += paso) if (r() > .06) L.box(x, y + .02, z, paso - .015, h, .065, r() > .85 ? pick(r, BEBIDAS) : col);
      }
    });
  }
  function palesSuelo(md, L, r) {
    const Lt = md.huecos * md.ancho;
    for (let i = 0; i < md.huecos; i++) pale(L, -Lt / 2 + (i + .5) * md.ancho, 0, 0, true, md.carga, md.cargaAlto, r);
  }
  function zona(md, L) {
    const w = md.ancho, d = md.fondo, t = .08, h = .9;
    L.box(0, 0, 0, w, .02, d, /tienda/i.test(md.nombre) ? '#a58aa0' : '#7c8ba1');
    L.box(0, 0, -d / 2 + t / 2, w, h, t, '#94a3b8');
    L.box(-w / 2 + t / 2, 0, 0, t, h, d, '#94a3b8');
    L.box(w / 2 - t / 2, 0, 0, t, h, d, '#94a3b8');
  }
  const CONSTRUCTOR = {gondola, metalica, rack, pale: palesSuelo, nevera, zona};

  function cartelMueble(texto) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 112;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(15,23,42,.82)'; const r = 26;
    g.beginPath(); g.moveTo(r, 4); g.arcTo(508, 4, 508, 108, r); g.arcTo(508, 108, 4, 108, r); g.arcTo(4, 108, 4, 4, r); g.arcTo(4, 4, 508, 4, r); g.fill();
    g.fillStyle = '#f8fafc'; g.font = '600 40px Segoe UI, Roboto, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let t = texto; while (g.measureText(t).width > 470 && t.length > 4) t = t.slice(0, -2);
    g.fillText(t === texto ? t : t + '…', 256, 58);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: new THREE.CanvasTexture(c), depthTest: false, transparent: true}));
    s.scale.set(3.6, .79, 1); s.renderOrder = 9;
    return s;
  }

  function crearMuebles() {
    const grupo = new THREE.Group(), geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: .85, metalness: .05});
    for (const md of LAYOUT.modulos) {
      const f = CONSTRUCTOR[md.tipo]; if (!f) continue;
      const L = new Lote(), r = rng(md.id + md.tipo + md.huecos + md.baldas);
      f(md, L, r); cabeceros(md, L, r);
      if (!L.b.length) continue;
      const im = new THREE.InstancedMesh(geo, mat, L.b.length), o = new THREE.Object3D(), col = new THREE.Color();
      L.b.forEach(([x, y, z, w, h, d, c], i) => { o.position.set(x, y, z); o.scale.set(w, h, d); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col.set(c)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      const g = new THREE.Group(); g.add(im);
      g.position.set(md.x - W / 2, 0, md.z - D / 2); g.rotation.y = md.rot * Math.PI / 180;
      grupo.add(g);
      // cartel con el nombre del mueble encima, como en el Modelador
      const alto = md.tipo === 'zona' ? .9 : md.tipo === 'pale' ? .15 + md.cargaAlto : md.alto;
      const et = cartelMueble(md.nombre); et.position.set(0, Math.max(alto, .9) + .7, 0); g.add(et);
    }
    return grupo;
  }

  /* ---------- Escena fija: suelo, paredes, puerta ---------- */
  function crearEscena() {
    const C = colores();
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(C.bg);

    camera = new THREE.PerspectiveCamera(45, 1, .1, K * 6);
    camera.position.set(...VISTA_ARRIBA.pos);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.maxPolarAngle = Math.PI * .48;
    controls.minDistance = 3;
    controls.maxDistance = K * 2.4;
    controls.autoRotateSpeed = 1.4;
    controls.addEventListener('start', () => {
      camTween = null;
      const a = el.querySelector('.p3d-ayuda'); if (a) a.style.opacity = 0;
    });

    // Luces, suelo, cuadrícula y paredes con los mismos colores que el Modelador
    const N = oscuro() ? {floor: '#3b4a60', grid: '#4b5d76', wall: '#94a3b8'} : {floor: '#cfd8e3', grid: '#b4c1d0', wall: '#64748b'};
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, .75));
    const sol = new THREE.DirectionalLight(0xffffff, .7); sol.position.set(-12, 30, 18); scene.add(sol);
    const sol2 = new THREE.DirectionalLight(0xffffff, .25); sol2.position.set(15, 12, -20); scene.add(sol2);

    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({color: N.floor, roughness: 1}));
    suelo.rotation.x = -Math.PI / 2; scene.add(suelo);
    const rej = new THREE.GridHelper(K, Math.round(K), N.grid, N.grid);
    rej.scale.set(W / K, 1, D / K); rej.position.y = .005;
    rej.material.transparent = true; rej.material.opacity = .5;
    scene.add(rej);

    // Paredes bajas semitransparentes, con la puerta delante a la derecha (como en el Modelador)
    const matPared = new THREE.MeshStandardMaterial({color: N.wall, transparent: true, opacity: .22});
    const hW = 2.2, t = .2, eI = W * .67, eD = W * .96;
    const muro = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hW, d), matPared); m.position.set(x - W / 2, hW / 2, z - D / 2); scene.add(m); };
    muro(W / 2, 0, W, t); muro(0, D / 2, t, D); muro(W, D / 2, t, D); muro(eI / 2, D, eI, t); muro((eD + W) / 2, D, W - eD, t);
    const ent = new THREE.Mesh(new THREE.BoxGeometry(eD - eI, .03, .3), new THREE.MeshBasicMaterial({color: C.accent}));
    ent.position.set((eI + eD) / 2 - W / 2, .02, D / 2); scene.add(ent);
    const cartel = cartelMueble('PUERTA');
    cartel.position.set((eI + eD) / 2 - W / 2, 1.2, D / 2 + 1.2); cartel.scale.set(2.6, .57, 1);
    scene.add(cartel);

    muebles = crearMuebles();
    scene.add(muebles);
    ubicsGrupo = new THREE.Group();
    scene.add(ubicsGrupo);

    raycaster = new THREE.Raycaster();
    puntero = new THREE.Vector2();
    let ini = null;
    renderer.domElement.addEventListener('pointerdown', e => { ini = {x: e.clientX, y: e.clientY, t: ahora()}; });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!ini || Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 8 || ahora() - ini.t > 500) return;
      const r = renderer.domElement.getBoundingClientRect();
      puntero.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      raycaster.setFromCamera(puntero, camera);
      const hit = raycaster.intersectObjects(Object.values(items).map(i => i.hit))[0];
      if (hit && onSelect) onSelect(hit.object.userData.codigo);
    });

    new ResizeObserver(ajustar).observe(el);
    ajustar();
  }

  function ajustar() {
    if (!renderer) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < .8 ? 52 : 45;
    camera.updateProjectionMatrix();
  }

  /* ---------- Ubicaciones: marca en el suelo, zona que se toca y cartel ---------- */
  function construir(lista) {
    const C = colores();
    liberar(ubicsGrupo);
    ubicsGrupo.clear();
    items = {};
    const porCodigo = Object.fromEntries(lista.map(u => [u.codigo, u]));
    lista.forEach(u => {
      let {x, z, w, d} = pos(u);
      // F1 (arriba) y F1M (medio) son el mismo palé a distinta altura: en 3D ocupan todo el fondo del rack
      const f = /^(F\d+)(M?)$/.exec(u.codigo), par = f && porCodigo[f[2] ? f[1] : f[1] + 'M'];
      if (par) { const p = pos(par), z0 = Math.min(z - d / 2, p.z - p.d / 2), z1 = Math.max(z + d / 2, p.z + p.d / 2); z = (z0 + z1) / 2; d = z1 - z0; }
      const n = Number(u.num_productos) || 0;
      const color = u.bajo_stock ? C.warn : n ? C.ok : null;
      const [y0, y1] = rangoY(u.codigo), alto = y1 - y0, yc = y0 + alto / 2;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      ubicsGrupo.add(g);

      if (color) {   // nivel con productos: caja de color transparente, para verla aunque la tape el mueble
        const vol = new THREE.Mesh(new THREE.BoxGeometry(w, alto, d), new THREE.MeshBasicMaterial({color, transparent: true, opacity: .22, depthWrite: false}));
        vol.position.y = yc; g.add(vol);
        const marco = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, alto, d)), new THREE.LineBasicMaterial({color}));
        marco.position.y = yc; g.add(marco);
      }

      const hit = new THREE.Mesh(new THREE.BoxGeometry(w, alto, d),
        new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
      hit.position.y = yc;
      hit.userData.codigo = u.codigo;
      g.add(hit);

      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + .08, alto + .08, d + .08)),
        new THREE.LineBasicMaterial({color: C.accent}));
      borde.position.y = yc;
      borde.visible = false;
      g.add(borde);

      const sub = n ? n + ' prod.' : '';
      // carteles de tamaño fijo en pantalla: se leen igual de cerca que de lejos
      const esc = /^EST/.test(u.codigo) ? .13 : .1;
      const et = etiqueta(u.codigo, sub, C, false, color, true);
      et.scale.set(esc, esc / 2, 1);
      et.position.set(0, f && f[2] ? yc : y1 + .3, 0);
      g.add(et);

      items[u.codigo] = {grupo: g, hit, borde, etiqueta: et, sub, esc, C, color, yc, resaltada: false};
    });
    marcarSeleccion();
  }

  function marcarSeleccion() {
    for (const [cod, it] of Object.entries(items)) {
      const sel = cod === selected;
      it.borde.visible = sel;
      if (it.resaltada !== sel) {
        const nueva = etiqueta(cod, it.sub, it.C, sel, it.color, true);
        nueva.scale.copy(it.etiqueta.scale);
        nueva.position.copy(it.etiqueta.position);
        it.grupo.remove(it.etiqueta);
        liberar(it.etiqueta);
        it.grupo.add(nueva);
        it.etiqueta = nueva;
        it.resaltada = sel;
      }
    }
  }

  /* ---------- Cámara ---------- */
  function irA(vista, dur = 1400) {
    const f = camera.aspect < .8 ? 1.15 : 1;
    camTween = {
      fromP: camera.position.clone(), toP: new THREE.Vector3(...vista.pos).multiplyScalar(f),
      fromT: controls.target.clone(), toT: new THREE.Vector3(...vista.target),
      t0: ahora(), dur
    };
  }
  // Acercar al elegido (como el botón del Modelador): la cámara se pone delante del nivel, desde el pasillo
  function enfocar(codigo, forzar) {
    const it = items[codigo];
    if (!it || (!forzar && ahora() < introHasta)) return;
    const p = it.grupo.position;
    const destino = new THREE.Vector3(p.x, Math.max(1, it.yc), p.z);
    const lado = p.x > 0 ? -1 : 1;
    camTween = {fromP: camera.position.clone(), toP: destino.clone().add(new THREE.Vector3(4.5 * lado, 4, 6)),
                fromT: controls.target.clone(), toT: destino, t0: ahora(), dur: 900};
  }

  /* ---------- Bucle ---------- */
  function bucle() {
    requestAnimationFrame(bucle);
    if (!activo || !el.offsetParent || document.hidden) return;
    const t = ahora();
    if (camTween) {
      const k = Math.min(1, (t - camTween.t0) / camTween.dur), e = easeInOut(k);
      camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
      controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
      if (k >= 1) camTween = null;
    }
    animaciones = animaciones.filter(a => {
      const k = (t - a.t0) / a.dur;
      if (k < 0) return true;
      a.paso(Math.min(1, k));
      return k < 1;
    });
    const it = items[selected];
    if (it) { const s = 1 + Math.sin(t / 260) * .03; it.borde.scale.set(s, 1, s); }
    // de lejos solo se ven los carteles de las ubicaciones con productos y la elegida, para no tapar el plano
    const lejos = camera.position.distanceTo(controls.target) > 18;
    for (const [cod, i] of Object.entries(items)) i.etiqueta.visible = !lejos || !!i.color || cod === selected;
    controls.update();
    renderer.render(scene, camera);
  }

  /* ---------- API pública ---------- */
  async function mostrar(contenedor, lista, opts = {}) {
    await cargar();
    onSelect = opts.onSelect || null;
    selected = opts.selected || null;
    const primeraVez = !renderer;
    if (primeraVez) { el = contenedor; crearEscena(); }
    activo = true;
    ajustar();
    actualizar(lista, selected, primeraVez);
    if (primeraVez) {
      camera.position.set(...VISTA_ARRIBA.pos).multiplyScalar(camera.aspect < .8 ? 1.15 : 1);
      // los muebles "se levantan" del suelo mientras el plano se inclina de 2D a 3D
      muebles.scale.y = .001; ubicsGrupo.visible = false;
      const t0 = ahora();
      animaciones.push({t0: t0 + 300, dur: 1300, paso: k => { muebles.scale.y = Math.max(.001, easeOutBack(k)); if (k >= 1) ubicsGrupo.visible = true; }});
      introHasta = t0 + 2600;
      setTimeout(() => irA(VISTA_INICIAL, 2200), 250);
      bucle();
    }
  }
  function actualizar(lista, sel, forzar = false) {
    if (!renderer) return;
    const firma = JSON.stringify(lista.map(u => [u.codigo, u.num_productos, u.bajo_stock, u.pos_left, u.pos_top, u.pos_w, u.pos_h]));
    selected = sel ?? selected;
    if (forzar || firma !== ultimoDatos) { ultimoDatos = firma; construir(lista); }
    else marcarSeleccion();
  }
  function seleccionar(codigo) {
    selected = codigo;
    if (!renderer || !activo) return;
    marcarSeleccion();
    enfocar(codigo);
  }
  function ocultar() { activo = false; }
  // Botones de vista: '3d', 'arriba', 'cerca' (los mismos que el Modelador). Devuelve la vista que queda puesta.
  function accion(nombre) {
    if (!renderer) return null;
    controls.autoRotate = false;
    if (nombre === 'arriba') { irA(VISTA_ARRIBA, 900); return 'arriba'; }
    if (nombre === 'cerca' && items[selected]) { enfocar(selected, true); return 'cerca'; }
    irA(VISTA_INICIAL, 900);
    return '3d';
  }

  window.Mapa3D = {mostrar, actualizar, seleccionar, ocultar, accion};
})();
