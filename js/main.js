/* Orbit site behavior: nav state, scroll reveals, practice radar. No dependencies. */

(function () {
  "use strict";

  // nav scrolled state
  var nav = document.querySelector(".nav");
  var onScroll = function () {
    if (window.scrollY > 12) { nav.classList.add("scrolled"); } else { nav.classList.remove("scrolled"); }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // mobile menu
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", links.classList.contains("open"));
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("open"); });
    });
  }

  // scroll reveals
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  document.querySelectorAll(".stagger").forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty("--i", i);
    });
  });

  // practice radar: signal dots drift along orbits and get drawn to the center
  var canvas = document.getElementById("radar");
  if (!canvas) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W, H, C, rings;

  var PINE = "#0b2e2b", CURRENT = "#0f9d8c", GLINT = "#7fe0d0", LINE = "#cfe4df";

  function size() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.width;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    C = W / 2;
    rings = [0.44, 0.33, 0.22].map(function (f) { return W * f; });
  }
  size();
  window.addEventListener("resize", size);

  function rand(a, b) { return a + Math.random() * (b - a); }

  function Signal() { this.reset(true); }
  Signal.prototype.reset = function (initial) {
    this.ring = Math.floor(rand(0, rings.length));
    this.r = rings[this.ring] + rand(-4, 4);
    this.a = rand(0, Math.PI * 2);
    this.speed = rand(0.0012, 0.003) * (Math.random() > 0.5 ? 1 : -1);
    this.pull = 0;                       // 0 = orbiting, > 0 = being captured
    this.pullDelay = rand(300, 1400);    // frames before capture begins
    this.size = rand(2.2, 4.2);
    if (!initial) this.pullDelay += 200;
  };
  Signal.prototype.step = function () {
    this.a += this.speed;
    if (this.pullDelay > 0) { this.pullDelay--; }
    else { this.pull += 0.0035; this.r -= this.r * this.pull * 0.02; }
    if (this.r < 10) { pulse = 1; this.reset(false); }
  };
  Signal.prototype.draw = function () {
    var x = C + Math.cos(this.a) * this.r;
    var y = C + Math.sin(this.a) * this.r;
    // trail
    ctx.beginPath();
    ctx.strokeStyle = "rgba(15,157,140," + (0.10 + this.pull * 2) + ")";
    ctx.lineWidth = 1.4;
    ctx.arc(C, C, this.r, this.a - 0.5, this.a);
    ctx.stroke();
    // dot
    ctx.beginPath();
    ctx.fillStyle = this.pull > 0 ? CURRENT : PINE;
    ctx.arc(x, y, this.size, 0, Math.PI * 2);
    ctx.fill();
    if (this.pull > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(127,224,208,.7)";
      ctx.lineWidth = 1;
      ctx.arc(x, y, this.size + 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  var signals = [];
  for (var i = 0; i < 14; i++) signals.push(new Signal());
  var t = 0, pulse = 0;

  function frame() {
    ctx.clearRect(0, 0, W, H);

    // rings
    rings.forEach(function (r, idx) {
      ctx.beginPath();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.setLineDash(idx === 1 ? [3, 6] : []);
      ctx.arc(C, C, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // sweep
    var sweep = t * 0.004;
    var grad = ctx.createConicGradient ? ctx.createConicGradient(sweep, C, C) : null;
    if (grad) {
      grad.addColorStop(0, "rgba(127,224,208,.22)");
      grad.addColorStop(0.12, "rgba(127,224,208,0)");
      grad.addColorStop(1, "rgba(127,224,208,0)");
      ctx.beginPath();
      ctx.fillStyle = grad;
      ctx.moveTo(C, C);
      ctx.arc(C, C, rings[0], sweep, sweep + 0.9);
      ctx.closePath();
      ctx.fill();
    }

    // center: the practice
    if (pulse > 0) pulse -= 0.02;
    var glow = 10 + Math.sin(t * 0.03) * 2 + pulse * 26;
    ctx.beginPath();
    ctx.fillStyle = "rgba(127,224,208," + (0.25 + pulse * 0.4) + ")";
    ctx.arc(C, C, glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = PINE;
    ctx.arc(C, C, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = GLINT;
    ctx.arc(C, C, 3, 0, Math.PI * 2);
    ctx.fill();

    signals.forEach(function (s) { s.step(); s.draw(); });

    t++;
    requestAnimationFrame(frame);
  }

  if (reduced) {
    // static composition for reduced motion
    rings.forEach(function (r) {
      ctx.beginPath(); ctx.strokeStyle = LINE; ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke();
    });
    signals.forEach(function (s) { s.draw(); });
    ctx.beginPath(); ctx.fillStyle = PINE; ctx.arc(C, C, 7, 0, Math.PI * 2); ctx.fill();
  } else {
    requestAnimationFrame(frame);
  }
})();
