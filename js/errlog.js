// Pannello di diagnostica a schermo: cattura errori JS e stato di avvio e li
// mostra direttamente nella pagina (utile su telefono, senza collegare il PC).
// Caricato per primo, così intercetta anche gli errori dei moduli successivi.
(function () {
  var panel, body, titleEl;
  function ensure() {
    if (panel) return;
    panel = document.createElement("div");
    panel.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;max-height:70vh;overflow:auto;background:#2a0d0d;color:#ffd9d9;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:12px;border-bottom:3px solid #a83a3a;white-space:pre-wrap;word-break:break-word;-webkit-user-select:text;user-select:text;";
    titleEl = document.createElement("div");
    titleEl.textContent = "⚠︎ Diagnostica avvio — tocca per copiare tutto";
    titleEl.style.cssText = "font-weight:bold;margin-bottom:8px;color:#ff9a9a;";
    body = document.createElement("div");
    panel.appendChild(titleEl);
    panel.appendChild(body);
    panel.addEventListener("click", function () {
      var t = body.innerText || body.textContent || "";
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { titleEl.textContent = "✓ Copiato"; }, function () {});
    });
    (document.body || document.documentElement).appendChild(panel);
  }
  function add(kind, msg) {
    ensure();
    var line = document.createElement("div");
    line.style.cssText = "margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #5a2020;";
    line.textContent = "[" + kind + "] " + msg;
    body.appendChild(line);
  }

  window.addEventListener("error", function (e) {
    if (e.error && e.error.stack) add("errore", e.error.stack);
    else add("errore", (e.message || "sconosciuto") + "  @ " + (e.filename || "?") + ":" + (e.lineno || "?") + ":" + (e.colno || "?"));
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    add("promise", r && r.stack ? r.stack : (r && r.message ? r.message : String(r)));
  });

  var origErr = console.error;
  console.error = function () {
    try {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        var a = arguments[i];
        parts.push(a && a.stack ? a.stack : (typeof a === "object" ? JSON.stringify(a) : String(a)));
      }
      add("console", parts.join(" "));
    } catch (_) {}
    origErr.apply(console, arguments);
  };

  // Riepilogo di stato dopo 4 secondi: risponde alle domande chiave in un colpo solo.
  window.addEventListener("load", function () {
    setTimeout(function () {
      var lines = [];
      lines.push("localforage caricato: " + (typeof (/** @type {any} */ (window)).localforage !== "undefined" ? "SÌ" : "NO ← problema"));
      lines.push("fogli di stile: " + document.styleSheets.length);
      try {
        var h = document.querySelector(".app-header");
        var bg = h ? getComputedStyle(h).backgroundColor : "(header assente)";
        var cssOk = bg === "rgb(28, 61, 92)";
        lines.push("CSS applicato: " + (cssOk ? "SÌ" : "NO ← header = " + bg));
      } catch (_) { lines.push("CSS: impossibile verificare"); }
      lines.push("app renderizzata: " + (document.querySelector(".statement") ? "SÌ" : "NO ← ferma su Caricamento"));
      lines.push("indexedDB disponibile: " + (typeof indexedDB !== "undefined" ? "SÌ" : "NO"));
      lines.push("online: " + navigator.onLine);
      lines.push("userAgent: " + navigator.userAgent);
      // Mostra il riepilogo solo se qualcosa è andato storto
      var rendered = document.querySelector(".statement");
      if (!rendered) { add("stato", lines.join("\n")); }
    }, 4000);
  });
})();
