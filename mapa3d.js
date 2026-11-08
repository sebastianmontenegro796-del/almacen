/* Vista 3D interactiva del almacén (Three.js).
   Uso: await Mapa3D.mostrar(contenedor, ubicaciones, {selected, onSelect})
        Mapa3D.actualizar(ubicaciones, selected) · Mapa3D.seleccionar(codigo) · Mapa3D.ocultar()
   Las posiciones salen de las mismas ubicaciones que el plano 2D (pos_left/top/w/h en %). */
(function () {
  const URLS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
                'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
  const ANCHO = 30, FONDO = 40;            // el plano es 3:4
  const VISTA_INICIAL = {pos: [8, 30, 37], target: [0, 0, 1]};
  const VISTA_ARRIBA = {pos: [0, 58, 0.01], target: [0, 0, 0]};

  let cargando = null;
  let el, renderer, scene, camera, controls, ubicsGrupo, raycaster, puntero;
  let items = {};           // codigo -> {grupo, hit, borde, etiqueta}
  let selected = null, onSelect = null;
  let animaciones = [];     // {obj, prop, from, to, t0, dur, ease}
  let camTween = null, activo = false, raf = 0, ultimoDatos = '', introHasta = 0;

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
  const easeOutBack = t => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function colores() {
    return {
      bg: css('--bg', '#0f172a'), card: css('--card', '#1e293b'), borde: css('--border', '#334155'),
      texto: css('--text', '#e2e8f0'), muted: css('--muted', '#94a3b8'), accent: css('--accent', '#38bdf8'),
      ok: css('--ok', '#4ade80'), warn: css('--warn', '#f87171'),
      madera: '#a47a4f', carton: '#c9a26a', poste: '#3f6aa8', viga: '#f59e0b'
    };
  }
  function pos(u) {
    const w = u.pos_w / 100 * ANCHO, d = u.pos_h / 100 * FONDO;
    return {x: u.pos_left / 100 * ANCHO - ANCHO / 2 + w / 2, z: u.pos_top / 100 * FONDO - FONDO / 2 + d / 2, w, d};
  }
  function caja(w, h, d, color, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({color, roughness: opts.rough ?? .8, metalness: opts.metal ?? 0}));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function liberar(obj) {
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }
  function etiqueta(texto, sub, C, resaltada) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = resaltada ? C.accent : 'rgba(15,23,42,.82)';
    g.strokeStyle = resaltada ? C.accent : C.borde;
    g.lineWidth = 4;
    const r = 26, x = 8, y = 14, w = 240, h = sub ? 100 : 76;
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = resaltada ? '#0f172a' : C.accent;
    g.font = 'bold 54px Segoe UI, Roboto, sans-serif';
    g.fillText(texto, 128, y + (sub ? 36 : h / 2 + 2));
    if (sub) {
      g.fillStyle = resaltada ? '#0f172a' : C.texto;
      g.font = '600 30px Segoe UI, Roboto, sans-serif';
      g.fillText(sub, 128, y + 78);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, depthTest: false, transparent: true}));
    s.renderOrder = 10;
    return s;
  }

  /* ---------- Escena fija: suelo, paredes, entrada ---------- */
  function crearEscena() {
    const C = colores();
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    el.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(C.bg);
    scene.fog = new THREE.Fog(C.bg, 70, 130);

    camera = new THREE.PerspectiveCamera(45, 1, .1, 300);
    camera.position.set(...VISTA_ARRIBA.pos);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.maxPolarAngle = Math.PI * .47;
    controls.minDistance = 8;
    controls.maxDistance = 85;
    controls.autoRotateSpeed = 1.4;
    controls.addEventListener('start', () => {
      camTween = null;
      const a = el.querySelector('.p3d-ayuda'); if (a) a.style.opacity = 0;
    });

    scene.add(new THREE.HemisphereLight('#dbeafe', '#0b1220', .75));
    const sol = new THREE.DirectionalLight('#ffffff', .85);
    sol.position.set(-18, 34, 22);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, {left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90});
    scene.add(sol);

    // Suelo con cuadrícula
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(ANCHO + 1.5, FONDO + 1.5),
      new THREE.MeshStandardMaterial({color: C.card, roughness: .95}));
    suelo.rotation.x = -Math.PI / 2; suelo.receiveShadow = true;
    scene.add(suelo);
    const rejilla = new THREE.GridHelper(FONDO + 1.5, 40, C.borde, C.borde);
    rejilla.scale.x = (ANCHO + 1.5) / (FONDO + 1.5);
    rejilla.position.y = .01;
    rejilla.material.transparent = true; rejilla.material.opacity = .45;
    scene.add(rejilla);

    // Paredes bajas semitransparentes (con hueco en la entrada)
    const matPared = new THREE.MeshStandardMaterial({color: C.muted, transparent: true, opacity: .22, roughness: 1});
    const H = 1.6, T = .25, xa = -ANCHO / 2, xb = ANCHO / 2, za = -FONDO / 2, zb = FONDO / 2;
    const entIzq = .36 * ANCHO - ANCHO / 2, entDer = .65 * ANCHO - ANCHO / 2;
    const tramos = [[xa, za, xb, za], [xa, za, xa, zb], [xb, za, xb, zb], [xa, zb, entIzq, zb], [entDer, zb, xb, zb]];
    for (const [x1, z1, x2, z2] of tramos) {
      const largo = Math.hypot(x2 - x1, z2 - z1);
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 === x2 ? T : largo, H, x1 === x2 ? largo : T), matPared);
      m.position.set((x1 + x2) / 2, H / 2, (z1 + z2) / 2);
      scene.add(m);
    }
    // Entrada: franja discontinua y cartel
    const matEnt = new THREE.MeshBasicMaterial({color: C.accent});
    for (let x = entIzq + .4; x < entDer - .3; x += 1.1) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(.6, .04, .22), matEnt);
      t.position.set(x + .3, .03, zb);
      scene.add(t);
    }
    const cartel = etiqueta('ENTRADA', '', C, false);
    cartel.position.set((entIzq + entDer) / 2, 1.4, zb + 1.6);
    cartel.scale.set(3.6, 1.8, 1);
    scene.add(cartel);

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
    // en pantallas estrechas (móvil) se aleja un poco la cámara para que quepa todo
    camera.fov = w / h < .8 ? 52 : 45;
    camera.updateProjectionMatrix();
  }

  /* ---------- Ubicaciones ---------- */
  function crearPale(g, w, d, n, C) {
    const madera = new THREE.MeshStandardMaterial({color: C.madera, roughness: .9});
    for (const f of [-.38, 0, .38]) {
      const taco = new THREE.Mesh(new THREE.BoxGeometry(w * .9, .16, d * .14), madera);
      taco.position.set(0, .08, f * d); taco.castShadow = true; g.add(taco);
    }
    const tabla = new THREE.Mesh(new THREE.BoxGeometry(w * .92, .1, d * .92), madera);
    tabla.position.y = .21; tabla.castShadow = true; tabla.receiveShadow = true; g.add(tabla);
    // cajas apiladas: hasta 4 por capa
    const total = Math.min(n, 12);
    const cw = w * .42, cd = d * .42, ch = Math.min(.75, Math.max(.45, cd * .9));
    for (let i = 0; i < total; i++) {
      const capa = Math.floor(i / 4), k = i % 4;
      const c = caja(cw, ch, cd, C.carton, {rough: .95});
      c.position.set((k % 2 ? 1 : -1) * w * .22, .26 + ch / 2 + capa * (ch + .02), (k < 2 ? -1 : 1) * d * .22);
      g.add(c);
    }
    return .26 + Math.ceil(total / 4) * (ch + .02);
  }

  function crearEstanteria(g, w, d, n, C) {
    const H = 3.8, niveles = 4;
    const matPoste = new THREE.MeshStandardMaterial({color: C.poste, roughness: .5, metalness: .4});
    const matViga = new THREE.MeshStandardMaterial({color: C.viga, roughness: .5, metalness: .3});
    // baldas oscuras y semitransparentes para que no tapen el resto del almacén
    const matBalda = new THREE.MeshStandardMaterial({color: '#334155', roughness: .8, metalness: .2, transparent: true, opacity: .55});
    const postes = Math.max(2, Math.round(d / 6) + 1);
    for (let i = 0; i < postes; i++) {
      const z = -d / 2 + .1 + i * ((d - .2) / (postes - 1));
      for (const x of [-w / 2 + .1, w / 2 - .1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(.16, H, .16), matPoste);
        p.position.set(x, H / 2, z); p.castShadow = true; g.add(p);
      }
    }
    const alturas = [];
    for (let k = 0; k < niveles; k++) {
      const y = .35 + k * (H - .6) / (niveles - 1);
      alturas.push(y);
      if (k < niveles - 1) {   // el nivel de arriba solo lleva vigas
        const b = new THREE.Mesh(new THREE.BoxGeometry(w - .1, .05, d - .1), matBalda);
        b.position.y = y; b.receiveShadow = true; g.add(b);
      }
      for (const x of [-w / 2 + .1, w / 2 - .1]) {
        const v = new THREE.Mesh(new THREE.BoxGeometry(.12, .2, d), matViga);
        v.position.set(x, y + .02, 0); g.add(v);
      }
    }
    // cajas repartidas por las baldas
    const total = Math.min(n, 30);
    const porBalda = Math.max(1, Math.ceil(total / (niveles - 1)));
    for (let i = 0; i < total; i++) {
      const nivel = Math.floor(i / porBalda), j = i % porBalda;
      const paso = (d - 1) / porBalda;
      const c = caja(w * .7, .6, Math.min(1.2, paso * .8), C.carton, {rough: .95});
      c.position.set(0, alturas[nivel] + .03 + .3, -d / 2 + .5 + paso * (j + .5));
      g.add(c);
    }
    return H;
  }

  function construir(lista) {
    const C = colores();
    liberar(ubicsGrupo);
    ubicsGrupo.clear();
    items = {};
    const t0 = ahora();
    lista.forEach((u, idx) => {
      const {x, z, w, d} = pos(u);
      const n = Number(u.num_productos) || 0;
      const estado = u.bajo_stock ? C.warn : n ? C.ok : C.borde;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      ubicsGrupo.add(g);

      // marca de estado en el suelo (como los colores del plano 2D)
      const marca = new THREE.Mesh(new THREE.PlaneGeometry(w + .2, d + .2),
        new THREE.MeshBasicMaterial({color: estado, transparent: true, opacity: n ? .35 : .18}));
      marca.rotation.x = -Math.PI / 2; marca.position.y = .02;
      g.add(marca);
      const marco = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + .2, .01, d + .2)),
        new THREE.LineBasicMaterial({color: estado}));
      marco.position.y = .03;
      g.add(marco);

      const cuerpo = new THREE.Group();
      g.add(cuerpo);
      const alto = u.vertical ? crearEstanteria(cuerpo, w, d, n, C) : crearPale(cuerpo, w, d, n, C);

      // zona que se puede tocar
      const hit = new THREE.Mesh(new THREE.BoxGeometry(w + .2, Math.max(alto, 1), d + .2),
        new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false}));
      hit.position.y = Math.max(alto, 1) / 2;
      hit.userData.codigo = u.codigo;
      g.add(hit);

      // contorno de selección
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(hit.geometry),
        new THREE.LineBasicMaterial({color: C.accent}));
      borde.position.copy(hit.position);
      borde.visible = false;
      g.add(borde);

      const sub = n ? n + ' prod.' : '';
      const et = etiqueta(u.codigo, sub, C, false);
      const esc = u.vertical ? 2.6 : (w > 3 ? 2.4 : 1.7);
      et.scale.set(esc, esc / 2, 1);
      et.position.set(0, (u.vertical ? alto : Math.max(alto, .4)) + esc * .35 + .2, u.vertical ? d / 2 - 1.5 : 0);
      g.add(et);

      const it = {grupo: g, cuerpo, hit, borde, etiqueta: et, u, sub, esc, C, resaltada: false, crecido: 0};
      items[u.codigo] = it;

      // animación de entrada: cada ubicación "crece" desde el suelo, una detrás de otra
      cuerpo.scale.y = .001; et.scale.multiplyScalar(.001);
      const delay = 350 + idx * 45;
      animaciones.push({t0: t0 + delay, dur: 650, paso: t => { cuerpo.scale.y = Math.max(.001, easeOutBack(t)); }});
      animaciones.push({t0: t0 + delay + 300, dur: 400, paso: t => {
        it.crecido = Math.max(.001, easeOutBack(t));
        it.etiqueta.scale.set(esc * it.crecido, esc / 2 * it.crecido, 1);
      }});
    });
    marcarSeleccion();
  }

  function marcarSeleccion() {
    for (const [cod, it] of Object.entries(items)) {
      const sel = cod === selected;
      it.borde.visible = sel;
      if (it.resaltada !== sel) {
        const nueva = etiqueta(cod, it.sub, it.C, sel);
        const s = it.crecido || .001;
        nueva.scale.set(it.esc * s, it.esc / 2 * s, 1);
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
    // en pantallas en vertical (móvil) la cámara se aleja para que quepa todo el almacén
    const f = camera.aspect < .8 ? 1.12 : 1;
    camTween = {
      fromP: camera.position.clone(), toP: new THREE.Vector3(...vista.pos).multiplyScalar(f),
      fromT: controls.target.clone(), toT: new THREE.Vector3(...vista.target),
      t0: ahora(), dur
    };
  }
  function enfocar(codigo) {
    const it = items[codigo];
    if (!it || ahora() < introHasta) return;   // no interrumpir la animación de entrada
    const p = it.grupo.position;
    // se acerca manteniendo el ángulo actual
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = Math.min(Math.max(camera.position.distanceTo(controls.target), 16), 28);
    const destino = new THREE.Vector3(p.x, 0, p.z);
    camTween = {fromP: camera.position.clone(), toP: destino.clone().add(dir.multiplyScalar(dist)),
                fromT: controls.target.clone(), toT: destino, t0: ahora(), dur: 900};
  }

  /* ---------- Bucle ---------- */
  function bucle() {
    raf = requestAnimationFrame(bucle);
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
    // la ubicación seleccionada "late" suavemente
    const it = items[selected];
    if (it) {
      const s = 1 + Math.sin(t / 260) * .04;
      it.borde.scale.set(s, 1, s);
    }
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
      camera.position.set(...VISTA_ARRIBA.pos).multiplyScalar(camera.aspect < .8 ? 1.12 : 1);
      introHasta = ahora() + 2600;
      setTimeout(() => irA(VISTA_INICIAL, 2200), 250);   // el plano "se inclina" de 2D a 3D
      bucle();
    }
  }
  function actualizar(lista, sel, forzar = false) {
    if (!renderer) return;
    const firma = JSON.stringify(lista.map(u => [u.codigo, u.num_productos, u.bajo_stock, u.pos_left, u.pos_top]));
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
  function accion(nombre) {
    if (!renderer) return false;
    if (nombre === 'arriba') { controls.autoRotate = false; irA(VISTA_ARRIBA); }
    if (nombre === 'centrar') { controls.autoRotate = false; irA(VISTA_INICIAL); }
    if (nombre === 'girar') { camTween = null; controls.autoRotate = !controls.autoRotate; }
    return controls.autoRotate;
  }

  window.Mapa3D = {mostrar, actualizar, seleccionar, ocultar, accion};
})();
