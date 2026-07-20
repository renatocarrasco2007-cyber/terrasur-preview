(function () {
  "use strict";

  var data = window.__BRAND__ || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "] failed:", e); }
  }

  function fmtInt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  /* ---------------------------------------------------------
     Nav scroll state
     --------------------------------------------------------- */
  function initNavScroll() {
    var nav = $(".nav");
    if (!nav) return;
    var onScroll = function () {
      if (window.scrollY > 12) nav.style.borderBottomColor = "rgba(255,157,46,.35)";
      else nav.style.borderBottomColor = "";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     Mobile menu — checkbox already handles the toggle in pure CSS.
     JS only closes it when a link is clicked.
     --------------------------------------------------------- */
  function initMobileMenuClose() {
    var toggle = $("#nav-toggle");
    var menu = $("[data-mobile-menu]");
    if (!toggle || !menu) return;
    $$("a", menu).forEach(function (a) {
      a.addEventListener("click", function () { toggle.checked = false; });
    });
  }

  /* ---------------------------------------------------------
     Language toggle (ES / EN)
     --------------------------------------------------------- */
  function setLang(lang) {
    document.documentElement.setAttribute("data-lang", lang);
    document.documentElement.setAttribute("lang", lang);
    try { localStorage.setItem("ts_lang", lang); } catch (_) {}
    $$("[data-lang-es]").forEach(function (el) { el.classList.toggle("is-active", lang === "es"); });
    $$("[data-lang-en]").forEach(function (el) { el.classList.toggle("is-active", lang === "en"); });
  }

  function initLangToggle() {
    var btn = $("[data-lang-toggle]");
    if (!btn) return;
    var saved = null;
    try { saved = localStorage.getItem("ts_lang"); } catch (_) {}
    if (saved === "es" || saved === "en") setLang(saved);
    else setLang(document.documentElement.getAttribute("data-lang") || "es");

    btn.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-lang") === "en" ? "en" : "es";
      setLang(current === "es" ? "en" : "es");
    });
  }

  /* ---------------------------------------------------------
     Reveal on scroll — threshold kept very low + 6s safety net
     --------------------------------------------------------- */
  function initReveals() {
    var items = $$(".reveal");
    if (!items.length) return;

    if (typeof IntersectionObserver === "undefined") {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -2% 0px" });

    items.forEach(function (el) { io.observe(el); });

    setTimeout(function () {
      items.forEach(function (el) {
        if (!el.classList.contains("is-visible") && el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add("is-visible");
        }
      });
    }, 6000);
  }

  /* ---------------------------------------------------------
     Count-up stats (hero) — starts from the real value already
     in the HTML, so no-JS visitors simply see the final number.
     --------------------------------------------------------- */
  function initCountUp() {
    var targets = $$("[data-count-to]");
    if (!targets.length) return;

    function animate(el) {
      var to = parseFloat(el.getAttribute("data-count-to"));
      if (!isFinite(to)) return;
      if (reduced) { el.textContent = fmtInt(to); return; }

      var duration = 1400;
      var start = null;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtInt(to * eased);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = fmtInt(to);
      }
      requestAnimationFrame(step);
    }

    if (typeof IntersectionObserver === "undefined") return; // values already correct in HTML

    var animated = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          animated.push(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -2% 0px" });

    targets.forEach(function (el) { io.observe(el); });

    // Safety net: values are already correct in the HTML, so this only
    // ensures the count-up plays even if the observer never fires.
    setTimeout(function () {
      targets.forEach(function (el) {
        if (animated.indexOf(el) === -1 && el.getBoundingClientRect().top < window.innerHeight) {
          animate(el);
        }
      });
    }, 6000);
  }

  /* ---------------------------------------------------------
     FAQ accordion
     --------------------------------------------------------- */
  function initFaq() {
    var items = $$(".faq-item");
    if (!items.length) return;

    items.forEach(function (item) {
      var btn = $(".faq-q", item);
      var panel = $(".faq-a", item);
      if (!btn || !panel) return;

      btn.setAttribute("aria-expanded", "false");

      btn.addEventListener("click", function () {
        var willOpen = !item.classList.contains("is-open");

        items.forEach(function (other) {
          if (other !== item) {
            other.classList.remove("is-open");
            var otherPanel = $(".faq-a", other);
            var otherBtn = $(".faq-q", other);
            if (otherPanel) otherPanel.style.maxHeight = "";
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
          }
        });

        item.classList.toggle("is-open", willOpen);
        btn.setAttribute("aria-expanded", String(willOpen));
        panel.style.maxHeight = willOpen ? panel.scrollHeight + "px" : "";
      });
    });
  }

  /* ---------------------------------------------------------
     Depth / resistivity cursor probe — the signature effect.
     Maps cursor Y position to a simulated depth (0-4000m) and
     a resistivity reading (1-1000 Ohm.m), echoing the real
     figures from the validated results section.
     --------------------------------------------------------- */
  function initProbe() {
    if (!fineHover) return;
    var probe = $("[data-probe]");
    if (!probe) return;
    var depthEl = $("[data-probe-depth]", probe);
    var resEl = $("[data-probe-res]", probe);
    var ready = false;

    window.addEventListener("mousemove", function (e) {
      probe.style.transform = "translate3d(" + e.clientX + "px," + e.clientY + "px,0)";

      var vh = window.innerHeight || 1;
      var depthFrac = Math.min(1, Math.max(0, e.clientY / vh));
      var depth = Math.round(depthFrac * 4000);
      var resistivity = Math.round(1 + Math.pow(depthFrac, 0.6) * 999);

      if (depthEl) depthEl.textContent = "DEPTH " + String(depth).padStart(4, "0") + " m";
      if (resEl) {
        resEl.textContent = "ρ " + resistivity + " Ω·m";
        resEl.classList.toggle("is-high", resistivity > 500);
      }

      if (!ready) {
        ready = true;
        probe.classList.add("is-ready");
      }
    }, { passive: true });

    window.addEventListener("mouseleave", function () { probe.classList.remove("is-ready"); });
  }

  /* ---------------------------------------------------------
     Hero resistivity cross-section — ambient canvas visual.
     A slow-drifting synthetic banding, not tied to real data,
     purely decorative (aria-hidden in the markup).
     --------------------------------------------------------- */
  function initResistivityCanvas() {
    var canvas = $("[data-resistivity-canvas]");
    if (!canvas) return;
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // Fixed pseudo-random layer seeds so it feels like real strata, not noise
    var layers = [];
    var n = 7;
    for (var i = 0; i < n; i++) {
      layers.push({
        base: i / n,
        amp: 14 + (i % 3) * 8,
        freq: 0.006 + i * 0.0015,
        speed: 0.00012 + i * 0.00004,
        hue: i % 2 === 0 ? "amber" : "teal"
      });
    }

    var amberRGB = [255, 157, 46];
    var tealRGB = [53, 201, 193];

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      layers.forEach(function (layer, idx) {
        var y0 = layer.base * h;
        var grad = ctx.createLinearGradient(0, y0 - 40, 0, y0 + 60);
        var rgb = layer.hue === "amber" ? amberRGB : tealRGB;
        var alpha = 0.10 + (idx % 3) * 0.05;
        grad.addColorStop(0, "rgba(" + rgb.join(",") + "," + alpha + ")");
        grad.addColorStop(1, "rgba(" + rgb.join(",") + ",0)");
        ctx.beginPath();
        ctx.moveTo(0, y0);
        for (var x = 0; x <= w; x += 8) {
          var yy = y0 + Math.sin(x * layer.freq + t * layer.speed + idx) * layer.amp;
          ctx.lineTo(x, yy);
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // Faint horizontal grid ticks
      ctx.strokeStyle = "rgba(226,236,234,0.06)";
      ctx.lineWidth = 1;
      for (var gy = 0; gy < h; gy += 28) {
        ctx.beginPath();
        ctx.moveTo(0, gy + 0.5);
        ctx.lineTo(w, gy + 0.5);
        ctx.stroke();
      }
    }

    var speedFactor = reduced ? 0.25 : 1;
    function loop(ts) {
      draw(ts * speedFactor);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------
     Contact form — no backend, submits via mailto:
     --------------------------------------------------------- */
  function initContactForm() {
    var form = $("[data-contact-form]");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var name = ($("#f-name", form) || {}).value || "";
      var org = ($("#f-org", form) || {}).value || "";
      var email = ($("#f-email", form) || {}).value || "";
      var industry = ($("#f-industry", form) || {}).value || "";
      var message = ($("#f-msg", form) || {}).value || "";

      var to = (data.contact && data.contact.email) || "info@tsgeophysics.cl";
      var subject = "Solicitud de acceso — " + (org || name || "TerraSur");
      var body = [
        "Nombre: " + name,
        "Empresa / Institución: " + org,
        "Email: " + email,
        "Industria: " + industry,
        "",
        message
      ].join("\n");

      var mailto = "mailto:" + encodeURIComponent(to) +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      window.location.href = mailto;

      var success = $("[data-form-success]", form);
      if (success) success.classList.add("is-visible");
    });
  }

  /* ---------------------------------------------------------
     Footer year
     --------------------------------------------------------- */
  function initFooterYear() {
    var el = $("[data-year]");
    if (!el) return;
    el.textContent = String((data.year) || new Date().getFullYear());
  }

  function boot() {
    safe(initNavScroll, "initNavScroll");
    safe(initMobileMenuClose, "initMobileMenuClose");
    safe(initLangToggle, "initLangToggle");
    safe(initReveals, "initReveals");
    safe(initCountUp, "initCountUp");
    safe(initFaq, "initFaq");
    safe(initProbe, "initProbe");
    safe(initResistivityCanvas, "initResistivityCanvas");
    safe(initContactForm, "initContactForm");
    safe(initFooterYear, "initFooterYear");

    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
