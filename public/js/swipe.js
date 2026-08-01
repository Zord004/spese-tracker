// Swipe-to-reveal in vanilla JS (pointer events, funziona su iOS Safari).
// Scorri la riga a sinistra per rivelare Clona / Elimina. Tap = modifica.
const ACTIONS_W = 132; // larghezza area azioni (px)

export function attachSwipe(container, { onEdit, onDelete, onClone, onQuickAmount }) {
  let openEl = null;
  const close = (el) => { if (!el) return; const f = el.querySelector(".swipe-face"); if (f) f.style.transform = "translateX(0)"; el.classList.remove("open"); if (openEl === el) openEl = null; };
  const open = (el) => { const f = el.querySelector(".swipe-face"); if (!f) return; if (openEl && openEl !== el) close(openEl); f.style.transform = `translateX(-${ACTIONS_W}px)`; el.classList.add("open"); openEl = el; };

  container.querySelectorAll(".swipe").forEach(el => {
    const face = el.querySelector(".swipe-face");
    const id = el.dataset.id;
    let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false, moved = false;

    face.addEventListener("pointerdown", (e) => {
      startX = e.clientX; startY = e.clientY; dx = 0; dragging = true; decided = false; horizontal = false; moved = false;
      face.style.transition = "none";
    });
    face.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (!decided) { if (Math.abs(mx) > 6 || Math.abs(my) > 6) { decided = true; horizontal = Math.abs(mx) > Math.abs(my); } else return; }
      if (!horizontal) { dragging = false; return; } // lascia scorrere la pagina in verticale
      moved = true;
      e.preventDefault();
      const base = (openEl === el) ? -ACTIONS_W : 0;
      dx = Math.max(-ACTIONS_W, Math.min(0, base + mx));
      face.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
      if (!dragging && !moved) return;
      dragging = false;
      face.style.transition = "";
      if (horizontal && dx < -ACTIONS_W / 2) open(el); else close(el);
    };
    face.addEventListener("pointerup", end);
    face.addEventListener("pointercancel", end);

    // Tap (nessuno spostamento) → modifica
    face.addEventListener("click", (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
      if (openEl === el) { close(el); return; }
      onEdit?.(id);
    });

    el.querySelectorAll(".swipe-act").forEach(btn => btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const act = btn.dataset.act;
      close(el);
      if (act === "delete") onDelete?.(id);
      else if (act === "clone") onClone?.(id);
    }));

    // Tap sull'importo → modifica rapida (se la riga è aperta, prima la chiude)
    const qa = el.querySelector(".qa");
    if (qa && onQuickAmount) qa.addEventListener("click", (e) => {
      e.stopPropagation();
      if (el.classList.contains("open")) { close(el); return; }
      onQuickAmount(id);
    });
  });

  // Chiudi la riga aperta toccando altrove
  const outside = (e) => { if (openEl && !openEl.contains(e.target)) close(openEl); };
  container.addEventListener("pointerdown", outside);
}

// Wrappa il markup di una riga in una struttura swipe
export function swipeWrap(id, innerHtml) {
  return `<div class="swipe" data-id="${id}">
    <div class="swipe-actions">
      <button class="swipe-act clone" data-act="clone">Clona</button>
      <button class="swipe-act del" data-act="delete">Elimina</button>
    </div>
    <div class="swipe-face">${innerHtml}</div>
  </div>`;
}
