/* Perrito mascota de Almacén MT.
   Un labrador con casco y chaleco recorre todo el borde de la pantalla (abajo → derecha → arriba → izquierda)
   y cambia de modelo cada 2 horas entre los 6 elegidos (1, 2, 3, 5, 8 y 9).
   Si lo tocas, se para, da un saltito y te dice una frase en un bocadillo. */
(function () {
  if (window.__perritoMT) return;
  window.__perritoMT = true;

  const COL = {pelo: '#7b4a24', claro: '#a46a36', oscuro: '#55301a', nariz: '#24140a', rosa: '#f9a8d4'};
  const o = (x, y) => `style="transform-origin:${x}px ${y}px"`;
  let uid = 0;

  /* ---------- Dibujos ---------- */
  function kawaii(op = {}) {
    const pata = (x, cls, c) => `<g class="${cls}" ${o(x + 5.5, 70)}>
        <rect x="${x}" y="68" width="11" height="20" rx="5.5" fill="${c}"/>
        <ellipse cx="${x + 6}" cy="88" rx="7.5" ry="4.2" fill="${c}"/></g>`;
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
    <g class="torso">
      ${pata(40, 'leg-a', COL.oscuro)}${pata(72, 'leg-b', COL.oscuro)}
      <path class="tail" ${o(34, 60)} d="M36 60 C24 60 17 50 21 40" stroke="${COL.pelo}" stroke-width="9" stroke-linecap="round" fill="none"/>
      <ellipse cx="60" cy="62" rx="31" ry="20" fill="${COL.pelo}"/>
      <ellipse cx="64" cy="71" rx="21" ry="8" fill="${COL.claro}" opacity=".6"/>
      <path d="M44 46 Q60 40 78 46 L80 78 Q60 84 42 78 Z" fill="#facc15"/>
      <rect x="43" y="56" width="37" height="4" fill="#e5e7eb"/><rect x="43" y="66" width="37" height="4" fill="#e5e7eb"/>
      ${pata(48, 'leg-b', COL.pelo)}${pata(80, 'leg-a', COL.pelo)}
      <g class="head" ${o(84, 62)}>
        <circle cx="96" cy="43" r="25" fill="${COL.pelo}"/>
        <ellipse cx="116" cy="53" rx="13" ry="9.5" fill="${COL.claro}"/>
        <ellipse cx="127" cy="49" rx="4.6" ry="3.6" fill="${COL.nariz}"/>
        <path d="M113 59 q6 5 12 0" stroke="${COL.nariz}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        ${op.boca ? `<rect x="108" y="54" width="20" height="15" rx="2" fill="#c9a26a" stroke="#8a6534" stroke-width="1.2"/><rect x="116.5" y="54" width="3" height="15" fill="#e9d5a7"/>` : ''}
        <circle cx="104" cy="39" r="6" fill="#1b1008"/>
        <circle cx="106.2" cy="36.8" r="2.2" fill="#fff"/><circle cx="102.4" cy="41.5" r="1.1" fill="#fff"/>
        <ellipse cx="108" cy="51" rx="5" ry="3" fill="${COL.rosa}" opacity=".7"/>
        ${op.panuelo ? `<g class="panuelo" ${o(84, 62)}><path d="M76 58 L104 62 L84 82 Z" fill="#f97316" stroke="#c2410c" stroke-width="1.5" stroke-linejoin="round"/>
                        <circle cx="86" cy="66" r="1.6" fill="#fff"/><circle cx="93" cy="65" r="1.6" fill="#fff"/><circle cx="87" cy="73" r="1.6" fill="#fff"/></g>` : ''}
        <path class="ear" ${o(84, 30)} d="M82 26 C70 30 69 54 78 59 C87 62 91 48 89 32 Z" fill="${COL.oscuro}"/>
        <path d="M73 30 a23 19 0 0 1 46 0 z" fill="#facc15"/><rect x="69" y="28" width="52" height="5" rx="2.5" fill="#eab308"/>
        <rect x="94" y="13" width="4" height="15" rx="2" fill="#fde047"/>
      </g>
    </g></svg>`;
  }

  function realista(op = {}) {
    const id = 'mtp' + (++uid);
    const borde = op.sticker ? `stroke="#2a170a" stroke-width="2" stroke-linejoin="round"` : '';
    const pata = (x, cls, col) => `<g class="${cls}" ${o(x + 5, 58)}>
        <rect x="${x}" y="56" width="10" height="32" rx="5" fill="${col}" ${borde}/>
        <ellipse cx="${x + 6.5}" cy="88" rx="7" ry="3.8" fill="${col}" ${borde}/></g>`;
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COL.claro}"/><stop offset=".55" stop-color="${COL.pelo}"/></linearGradient>
      <filter id="${id}f" x="-20%" y="-20%" width="140%" height="140%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="3.2" result="d"/>
        <feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="${id}cv"><rect x="28" y="36" width="76" height="32" rx="16"/><path d="M86 44 Q96 26 106 21 L125 30 Q114 50 108 64 Z"/></clipPath>
    </defs>
    <g ${op.sticker ? `filter="url(#${id}f)"` : ''}><g class="torso">
      ${pata(34, 'leg-a', COL.oscuro)}${pata(84, 'leg-b', COL.oscuro)}
      <path class="tail" ${o(30, 50)} d="M31 46 C17 48 7 57 2 70 C9 66 17 59 31 56 Z" fill="${COL.pelo}" ${borde}/>
      <path d="M86 44 Q96 26 106 21 L125 30 Q114 50 108 64 Z" fill="${COL.pelo}" ${borde}/>
      <rect x="28" y="36" width="76" height="32" rx="16" fill="url(#${id}g)" ${borde}/>
      <ellipse cx="42" cy="54" rx="15" ry="15" fill="${COL.pelo}"/><ellipse cx="98" cy="56" rx="12" ry="13" fill="${COL.claro}" opacity=".55"/>
      <g clip-path="url(#${id}cv)"><rect x="54" y="30" width="56" height="40" fill="#facc15"/>
        <rect x="54" y="46" width="56" height="4.5" fill="#e5e7eb"/><rect x="54" y="57" width="56" height="4.5" fill="#e5e7eb"/>
        <rect x="70" y="30" width="4.5" height="40" fill="#e5e7eb"/></g>
      <path d="M54 37 L54 67" stroke="#a16207" stroke-width="1.6"/>
      ${op.caja ? `<g><rect x="46" y="18" width="34" height="22" rx="2" fill="#c9a26a" stroke="#8a6534" stroke-width="1.5"/>
                   <rect x="61" y="18" width="4" height="22" fill="#e9d5a7"/><path d="M44 38 L82 38" stroke="#334155" stroke-width="3"/>
                   <path d="M50 40 L48 66 M76 40 L78 66" stroke="#334155" stroke-width="2.5"/></g>` : ''}
      ${pata(42, 'leg-b', COL.pelo)}${pata(92, 'leg-a', COL.pelo)}
      <g class="head" ${o(108, 40)}>
        ${op.sticker ? `<path d="M102 40 q10 8 22 1" stroke="#38bdf8" stroke-width="5" fill="none" stroke-linecap="round"/>
                     <circle cx="112" cy="47" r="3.4" fill="#fbbf24" stroke="#b45309" stroke-width="1"/>` : ''}
        <ellipse cx="114" cy="24" rx="15" ry="13" fill="${COL.pelo}" ${borde}/>
        <rect x="112" y="22" width="25" height="14" rx="7" fill="${COL.pelo}" ${borde}/>
        <path d="M116 33 q9 4 20 0" stroke="${COL.oscuro}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <ellipse cx="135.5" cy="25" rx="4" ry="3.3" fill="${COL.nariz}"/>
        <ellipse cx="119" cy="19" rx="2.7" ry="2.5" fill="#1b1008"/><circle cx="120" cy="18" r=".9" fill="#fff"/>
        <path class="ear" ${o(106, 16)} d="M105 12 C96 15 96 33 102 38 C109 40 113 30 111 16 Z" fill="${COL.oscuro}" ${borde}/>
        <path d="M100 15 a15 12 0 0 1 30 0 z" fill="#facc15" ${op.sticker ? 'stroke="#2a170a" stroke-width="2"' : ''}/>
        <rect x="96" y="13" width="38" height="4.5" rx="2.2" fill="#eab308" ${op.sticker ? 'stroke="#2a170a" stroke-width="1.6"' : ''}/>
        <rect x="113" y="2" width="3.5" height="12" rx="1.7" fill="#fde047"/>
      </g>
    </g></g></svg>`;
  }

  // Los 6 elegidos, en orden; velocidad en px/s y ritmo del paso en s
  const MODELOS = [
    {crear: () => kawaii(), vel: 42, v: .32},                       // 1 Kawaii
    {crear: () => realista(), vel: 62, v: .3},                      // 2 Labrador de verdad
    {crear: () => realista({sticker: true}), vel: 58, v: .3},       // 3 Pegatina
    {crear: () => kawaii({boca: true}), vel: 40, v: .34},           // 5 Mozo con caja
    {crear: () => kawaii({panuelo: true}), vel: 80, v: .22},        // 8 Pañuelo al viento
    {crear: () => realista({caja: true}), vel: 46, v: .34},         // 9 Transportista
  ];
  const DOS_HORAS = 2 * 60 * 60 * 1000;
  const modeloActual = () => Math.floor(Date.now() / DOS_HORAS) % MODELOS.length;

  /* ---------- Estilos (todo dentro de .mt-perro para no chocar con la app) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .mt-perro{position:fixed;left:0;top:0;width:76px;height:54px;z-index:40;cursor:pointer;-webkit-tap-highlight-color:transparent;will-change:transform;
    transform-origin:50% 100%;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}
  .mt-perro svg{width:100%;height:100%;display:block;overflow:visible}
  .mt-perro.andando .leg-a{animation:mtPaso var(--v) ease-in-out infinite alternate}
  .mt-perro.andando .leg-b{animation:mtPaso var(--v) ease-in-out infinite alternate-reverse}
  .mt-perro.andando .torso{animation:mtBote var(--v) ease-in-out infinite alternate}
  .mt-perro.andando .ear{animation:mtOreja var(--v) ease-in-out infinite alternate}
  .mt-perro .tail{animation:mtCola .26s ease-in-out infinite alternate}
  .mt-perro.feliz .tail{animation-duration:.13s}
  .mt-perro.feliz .head{animation:mtAsiente .5s ease-in-out infinite alternate}
  .mt-perro .panuelo{animation:mtOndea .3s ease-in-out infinite alternate}
  @keyframes mtPaso{from{transform:rotate(22deg)}to{transform:rotate(-22deg)}}
  @keyframes mtBote{from{transform:translateY(0)}to{transform:translateY(-2.5px)}}
  @keyframes mtOreja{from{transform:rotate(-5deg)}to{transform:rotate(9deg)}}
  @keyframes mtCola{from{transform:rotate(-12deg)}to{transform:rotate(20deg)}}
  @keyframes mtAsiente{from{transform:rotate(0)}to{transform:rotate(-7deg)}}
  @keyframes mtOndea{from{transform:skewX(-8deg)}to{transform:skewX(8deg)}}
  .mt-perro.salta svg{animation:mtSalto .45s ease-out}
  @keyframes mtSalto{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px)}}
  .mt-bocadillo{position:fixed;left:0;top:0;z-index:41;max-width:min(240px,calc(100vw - 24px));padding:9px 13px;border-radius:14px;
    background:#fff;color:#0f172a;font:600 14px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);
    pointer-events:none;opacity:0;transform:scale(.85);transition:opacity .18s,transform .18s}
  .mt-bocadillo.ver{opacity:1;transform:scale(1)}
  @media (prefers-reduced-motion:reduce){.mt-perro,.mt-bocadillo{display:none}}`;
  document.head.appendChild(css);

  const perro = document.createElement('div');
  perro.className = 'mt-perro andando';
  document.body.appendChild(perro);

  let modelo = -1, cfg = MODELOS[0];
  function ponerModelo() {
    const m = modeloActual();
    if (m === modelo) return;
    modelo = m; cfg = MODELOS[m];
    perro.innerHTML = cfg.crear();
    perro.style.setProperty('--v', cfg.v + 's');
  }
  ponerModelo();
  setInterval(ponerModelo, 60 * 1000);   // revisa cada minuto si ya tocan otras 2 horas

  /* ---------- Recorrido por el borde (sentido contrario a las agujas del reloj, patas siempre hacia el borde) ---------- */
  // s = distancia recorrida. Tramos: abajo (→), derecha (↑), arriba (←), izquierda (↓)
  let s = Math.random() * 400, ultimo = performance.now(), pausa = 0, proximaPausa = 12 + Math.random() * 15;
  function punto(dist) {
    const W = document.documentElement.clientWidth, H = window.innerHeight;
    const per = 2 * (W + H);
    let d = ((dist % per) + per) % per;
    if (d < W) return {x: d, y: H, ang: 0};
    d -= W; if (d < H) return {x: W, y: H - d, ang: -90};
    d -= H; if (d < W) return {x: W - d, y: 0, ang: -180};
    d -= W; return {x: 0, y: d, ang: -270};
  }
  function frame(t) {
    const dt = Math.min(60, t - ultimo) / 1000; ultimo = t;
    if (!document.hidden) {
      if (pausa > 0) {
        pausa -= dt;
        if (pausa <= 0) { perro.classList.add('andando'); perro.classList.remove('feliz'); }
      } else {
        s += cfg.vel * dt;
        proximaPausa -= dt;
        if (proximaPausa <= 0) {      // de vez en cuando se para a menear la cola
          pausa = 2; proximaPausa = 15 + Math.random() * 20;
          perro.classList.remove('andando'); perro.classList.add('feliz');
        }
      }
      const p = punto(s);
      // el punto (x, y) es donde apoyan las patas; el dibujo se coloca encima y se gira para pisar el borde
      perro.style.transform = `translate(${p.x - 38}px, ${p.y - 54}px) rotate(${p.ang}deg)`;
      if (hablando) colocarBocadillo(p);
    }
    requestAnimationFrame(frame);
  }
  /* ---------- Si lo tocas: se para, salta y dice algo ---------- */
  // Frases del jefe (salen al azar, sin repetir la misma dos veces seguidas)
  const FRASES = ['Ya cerremos', 'Tengo hambre', 'Oe ñaño, tráete un encebollado', 'No, mañana', 'Nou tumorou'];
  const saludo = () => { const h = new Date().getHours(); return h < 6 ? '¡Uf, qué tarde! ¿Aún trabajando? 🌙' : h < 13 ? '¡Buenos días! ☀️' : h < 20 ? '¡Buenas tardes!' : '¡Buenas noches! 🌙'; };
  const bocadillo = document.createElement('div');
  bocadillo.className = 'mt-bocadillo'; bocadillo.setAttribute('role', 'status'); bocadillo.setAttribute('aria-live', 'polite');
  document.body.appendChild(bocadillo);
  perro.setAttribute('aria-label', 'Perrito del almacén: tócalo y te dice algo');
  let hablando = false, tHablar = 0, ultimaFrase = -1, saludado = false;
  function colocarBocadillo(p) {
    const W = document.documentElement.clientWidth, H = window.innerHeight, bw = bocadillo.offsetWidth, bh = bocadillo.offsetHeight, m = 8;
    let x, y;
    if (p.ang === 0) { x = p.x - bw / 2; y = p.y - 54 - bh - m; }           // abajo: el bocadillo encima
    else if (p.ang === -90) { x = p.x - 54 - bw - m; y = p.y - bh / 2; }    // derecha: a su izquierda
    else if (p.ang === -180) { x = p.x - bw / 2; y = p.y + 54 + m; }        // arriba: debajo
    else { x = p.x + 54 + m; y = p.y - bh / 2; }                            // izquierda: a su derecha
    x = Math.max(m, Math.min(W - bw - m, x)); y = Math.max(m, Math.min(H - bh - m, y));
    bocadillo.style.transform = ''; bocadillo.style.left = x + 'px'; bocadillo.style.top = y + 'px';
  }
  perro.addEventListener('click', e => {
    e.stopPropagation();
    let i; do { i = Math.floor(Math.random() * FRASES.length); } while (i === ultimaFrase && FRASES.length > 1);
    ultimaFrase = i;
    bocadillo.textContent = FRASES[i];
    hablando = true; pausa = 3.2;
    perro.classList.remove('andando', 'salta'); void perro.offsetWidth; perro.classList.add('feliz', 'salta');
    if (navigator.vibrate) navigator.vibrate(30);
    colocarBocadillo(punto(s));
    bocadillo.classList.add('ver');
    clearTimeout(tHablar);
    tHablar = setTimeout(() => { bocadillo.classList.remove('ver'); hablando = false; perro.classList.remove('salta'); }, 3000);
  });
  requestAnimationFrame(frame);
})();
