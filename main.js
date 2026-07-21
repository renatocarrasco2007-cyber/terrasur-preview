(function () {
  "use strict";

  var data = window.__BRAND__ || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      nav.style.boxShadow = window.scrollY > 12 ? "0 4px 16px rgba(18,16,12,.06)" : "";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     Mobile menu — the checkbox already handles the toggle in pure
     CSS via the :checked ~ sibling selector. This also mirrors the
     checkbox state onto .is-open classes as a redundant rendering
     path, in case a mobile browser's general-sibling-combinator
     repaint lags behind a sticky + backdrop-filter ancestor. Closes
     on link click either way.
     --------------------------------------------------------- */
  function initMobileMenu() {
    var toggle = $("#nav-toggle");
    var menu = $("[data-mobile-menu]");
    var backdrop = $("[data-mobile-backdrop]");
    var burger = $(".nav-burger");
    if (!toggle || !menu) return;

    function sync() {
      menu.classList.toggle("is-open", toggle.checked);
      if (burger) burger.classList.toggle("is-open", toggle.checked);
      if (backdrop) backdrop.classList.toggle("is-open", toggle.checked);
    }
    toggle.addEventListener("change", sync);
    sync();

    $$("a", menu).forEach(function (a) {
      a.addEventListener("click", function () {
        toggle.checked = false;
        sync();
      });
    });

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        toggle.checked = false;
        sync();
      });
    }
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

    // Reveal anything already on/near screen immediately — don't make the
    // very first paint depend on an async IntersectionObserver callback.
    var pending = [];
    items.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.15) el.classList.add("is-visible");
      else pending.push(el);
    });

    if (!pending.length) return;

    if (typeof IntersectionObserver === "undefined") {
      pending.forEach(function (el) { el.classList.add("is-visible"); });
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

    pending.forEach(function (el) { io.observe(el); });

    setTimeout(function () {
      pending.forEach(function (el) {
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
    safe(initMobileMenu, "initMobileMenu");
    safe(initLangToggle, "initLangToggle");
    safe(initReveals, "initReveals");
    safe(initCountUp, "initCountUp");
    safe(initFaq, "initFaq");
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
