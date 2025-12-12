const cfg = {
  roles: {
    en: [
      "Software Developer in Training",
      "C# Specialist",
      "Game Developer",
    ],
    fi: [
      "Ohjelmistokehittäjä koulutuksessa",
      "C#-asiantuntija",
      "Pelikehittäjä",
    ]
  },
  roleSwitchInterval: 3000,
  roleFadeDuration: 350,
  revealRootMargin: "0px 0px -12% 0px",
  revealThreshold: 0.12,
  wave: {
    rows: 20,
    cols: 30,
    spacingX: null,
    spacingY: null,
    amplitude: 5.0,
    speed: 5.0,
    lineWidth: 2.0,
    pointRadius: 0.4,
    opacity: 0.15,
    mouseInfluence: 400,
    mouseStrength: 400,
    holeRadius: 20
  },
  tilt: {
    maxRotate: 10,
    scale: 1.03
  }
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function setupFullPageCanvas() {
  const canvas = document.createElement("canvas");
  canvas.id = "wavefield";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    zIndex: 0,
    display: "block",
    pointerEvents: "none",
    opacity: cfg.wave.opacity
  });
  document.body.prepend(canvas);
  return canvas;
}

function Wavefield(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d", { alpha: true });
  let width = 0;
  let height = 0;
  let points = [];
  let animationId;
  let time = 0;
  let mouse = { x: null, y: null };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    initPoints();
  }

  function initPoints() {
    points = [];
    const cols = Math.max(8, Math.round(cfg.wave.cols * (width / 1100)));
    const rows = Math.max(6, cfg.wave.rows);
    cfg.wave.spacingX = width / (cols - 1 || 1);
    cfg.wave.spacingY = height / (rows - 1 || 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cfg.wave.spacingX;
        const y = r * cfg.wave.spacingY;
        points.push({
          x,
          y,
          r,
          c,
          phase: Math.random() * Math.PI * 2,
          speed: cfg.wave.speed * (0.6 + Math.random() * 0.8),
          amp: cfg.wave.amplitude * (0.6 + Math.random() * 0.9),
          axPrev: x,
          ayPrev: y,
          hidden: false
        });
      }
    }
  }

  function getIndex(r, c, cols) {
    return r * cols + c;
  }

  function segmentCrossesHole(ax, ay, bx, by, hx, hy, hr) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = hx - ax;
    const wy = hy - ay;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) return false;
    let t = (wx * vx + wy * vy) / len2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const cx = ax + vx * t;
    const cy = ay + vy * t;
    const dx = cx - hx;
    const dy = cy - hy;
    return dx * dx + dy * dy <= hr * hr;
  }

  function drawGrid() {
    ctx.clearRect(0, 0, width, height);
    if (!points.length) return;

    const firstR = points[0].r;
    const cols = points.filter(p => p.r === firstR).length;
    const rows = Math.ceil(points.length / cols);

    ctx.lineWidth = cfg.wave.lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "lighter";

    const R = cfg.wave.mouseInfluence;
    const holeR = cfg.wave.holeRadius;

    for (let p of points) {
      const siny = Math.sin(time * p.speed + p.phase) * p.amp;
      const sinx = Math.cos(time * p.speed + p.phase) * p.amp;
      if (mouse.x === null || mouse.y === null) {
        p.hidden = false;
        p.targetAx = p.x + sinx;
        p.targetAy = p.y + siny;
      } else {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= holeR) {
          p.hidden = true;
          const safeDist = Math.max(dist, 0.0001);
          p.targetAx = mouse.x + (dx / safeDist) * holeR + sinx;
          p.targetAy = mouse.y + (dy / safeDist) * holeR + siny;
        } else if (dist < R) {
          p.hidden = false;
          const nd = (dist - holeR) / Math.max(R - holeR, 0.0001);
          const fall = Math.pow(1 - nd, 2);
          const strength = fall * cfg.wave.mouseStrength;
          const safeDist = Math.max(dist, 0.0001);
          const ux = dx / safeDist;
          const uy = dy / safeDist;
          const tx = -uy;
          const ty = ux;
          const radialPush = strength * 0.02;
          const tangential = strength * 0.12 * (1 + 0.5 * fall);
          const nx = mouse.x + ux * (dist + radialPush) + tx * tangential + sinx;
          const ny = mouse.y + uy * (dist + radialPush) + ty * tangential + siny;
          p.targetAx = nx;
          p.targetAy = ny;
        } else {
          p.hidden = false;
          p.targetAx = p.x + sinx;
          p.targetAy = p.y + siny;
        }
      }

      p.axPrev += (p.targetAx - p.axPrev) * 0.18;
      p.ayPrev += (p.targetAy - p.ayPrev) * 0.18;
      p.ax = p.axPrev;
      p.ay = p.ayPrev;
    }

    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = points[getIndex(r, c, cols)];
        const b = points[getIndex(r, c + 1, cols)];
        if (a.hidden || b.hidden) continue;
        if (mouse.x !== null && mouse.y !== null && segmentCrossesHole(a.ax, a.ay, b.ax, b.ay, mouse.x, mouse.y, holeR)) continue;
        ctx.moveTo(a.ax, a.ay);
        ctx.lineTo(b.ax, b.ay);
      }
    }

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows - 1; r++) {
        const a = points[getIndex(r, c, cols)];
        const b = points[getIndex(r + 1, c, cols)];
        if (a.hidden || b.hidden) continue;
        if (mouse.x !== null && mouse.y !== null && segmentCrossesHole(a.ax, a.ay, b.ax, b.ay, mouse.x, mouse.y, holeR)) continue;
        ctx.moveTo(a.ax, a.ay);
        ctx.lineTo(b.ax, b.ay);
      }
    }

    ctx.strokeStyle = "rgba(104, 96, 212, 0.8)";
    ctx.stroke();

    ctx.beginPath();
    for (let p of points) {
      if (p.hidden) continue;
      ctx.moveTo(p.ax + cfg.wave.pointRadius, p.ay);
      ctx.arc(p.ax, p.ay, cfg.wave.pointRadius, 0, Math.PI * 2);
    }
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
  }

  let lastTs = null;

  function step(ts) {
    if (!lastTs) lastTs = ts;
    const delta = (ts - lastTs) / 1000;
    lastTs = ts;
    time += delta;
    drawGrid();
    requestAnimationFrame(step);
  }

  function start() {
    if (!animationId) animationId = requestAnimationFrame(step);
  }

  function stop() {
    if (animationId) cancelAnimationFrame(animationId);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  resize();
  start();

  return { start, stop, resize };
}

let currentLang = localStorage.getItem('lang') || 'en';
let roleCyclerInterval = null;
let roleCyclerTimeout = null;

function setupRoleCycler() {
  const brand = $(".brand");
  if (!brand) return;
  if (roleCyclerInterval) {
    clearInterval(roleCyclerInterval);
    roleCyclerInterval = null;
  }
  if (roleCyclerTimeout) {
    clearTimeout(roleCyclerTimeout);
    roleCyclerTimeout = null;
  }
  
  let holder = brand.querySelector(".role-cycler");
  if (!holder) {
    holder = document.createElement("div");
    holder.className = "role-cycler";
    Object.assign(holder.style, {
      marginTop: "6px",
      fontSize: "0.95rem",
      color: "var(--muted, #64748b)",
      minHeight: "1.2em",
      position: "relative",
      lineHeight: "1",
      overflow: "visible"
    });
    brand.appendChild(holder);
  }

  const existingSpan = holder.querySelector("#role-cycle");
  if (existingSpan) {
    existingSpan.remove();
  }

  const span = document.createElement("span");
  span.id = "role-cycle";
  const roles = cfg.roles[currentLang] || cfg.roles.en;
  span.textContent = roles[0];
  Object.assign(span.style, {
    display: "inline-block",
    transition: `opacity ${cfg.roleFadeDuration}ms ease, transform ${cfg.roleFadeDuration}ms ease`,
    opacity: "1"
  });
  holder.appendChild(span);

  let idx = 0;

  function showNextRole() {
    const roles = cfg.roles[currentLang] || cfg.roles.en;
    const nextIdx = (idx + 1) % roles.length;
    span.style.opacity = "0";
    span.style.transform = "translateY(-6px)";
    roleCyclerTimeout = setTimeout(() => {
      span.textContent = roles[nextIdx];
      span.style.opacity = "1";
      span.style.transform = "translateY(0)";
      idx = nextIdx;
    }, cfg.roleFadeDuration);
  }

  roleCyclerInterval = setInterval(showNextRole, cfg.roleSwitchInterval);
  
  window.addEventListener("beforeunload", () => {
    if (roleCyclerInterval) clearInterval(roleCyclerInterval);
    if (roleCyclerTimeout) clearTimeout(roleCyclerTimeout);
  });
}

function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;

  const elements = document.querySelectorAll('[data-en], [data-fi]');
  elements.forEach(el => {
    if (el.dataset[lang]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = el.dataset[lang];
      } else {
        el.textContent = el.dataset[lang];
      }
    }
  });

  const langButtons = document.querySelectorAll('.lang-btn');
  langButtons.forEach(btn => {
    if (btn.dataset.lang === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  setupRoleCycler();
}

function setupLanguageSwitcher() {
  const langButtons = document.querySelectorAll('.lang-btn');
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      switchLanguage(lang);
    });
  });

  switchLanguage(currentLang);
}

function setupScrollReveal() {
  const sections = $$("main.container section, .project-card, .spoken-card");
  if (!sections.length) return;
  sections.forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(18px)";
    el.style.transition = "opacity 520ms cubic-bezier(.2,.9,.2,1), transform 520ms cubic-bezier(.2,.9,.2,1)";
    el.style.willChange = "opacity, transform";
  });

  const obs = new IntersectionObserver(
    entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const el = en.target;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.unobserve(el);
        }
      });
    },
    { root: null, rootMargin: cfg.revealRootMargin, threshold: cfg.revealThreshold }
  );

  sections.forEach(s => obs.observe(s));
}

function setupCardTilt() {
  const cards = $$(".project-card, .spoken-card, .t-t-card");
  if (!cards.length) return;
  let raf = null;

  function onMove(e, card) {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * cfg.tilt.maxRotate * -1;
      const rotateX = (py - 0.5) * cfg.tilt.maxRotate;
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${cfg.tilt.scale})`;
      card.style.transition = "transform 120ms linear";
      card.style.willChange = "transform";
      card.style.boxShadow = "0 18px 40px rgba(7, 10, 25, 0.12)";
    });
  }

  function onLeave(card) {
    if (raf) cancelAnimationFrame(raf);
    card.style.transition = "transform 400ms cubic-bezier(.2,.9,.2,1), box-shadow 300ms ease";
    card.style.transform = "none";
    card.style.boxShadow = "";
  }

  cards.forEach(card => {
    card.addEventListener("mousemove", e => onMove(e, card));
    card.addEventListener("mouseleave", () => onLeave(card));
    card.addEventListener("focusin", () => {
      card.style.transform = `scale(${cfg.tilt.scale})`;
    });
    card.addEventListener("focusout", () => {
      card.style.transform = "none";
    });
  });
}

function initAll() {
  const canvas = setupFullPageCanvas();
  const wave = Wavefield(canvas);
  setupLanguageSwitcher();
  setupRoleCycler();
  setupScrollReveal();
  setupCardTilt();

  if (canvas) {
    const ro = new ResizeObserver(() => {
      if (wave && wave.resize) wave.resize();
    });
    ro.observe(document.body);
  }
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(initAll, 50);
} else {
  document.addEventListener("DOMContentLoaded", initAll);
}
