// Raggruppa "titolo di sezione + contenuto" in blocchi <section class="blk">.
// Su mobile i blocchi sono trasparenti (nessun effetto visivo); su desktop il CSS
// li dispone su più colonne senza spezzarli. I listener già agganciati agli
// elementi restano validi: gli elementi vengono spostati, non ricreati.
/** @param {HTMLElement} root */
export function groupBlocks(root) {
  let cur = null;
  for (const k of Array.from(root.children)) {
    if (k.classList.contains("statement") || k.classList.contains("subtabs") || k.classList.contains("blk")) { cur = null; continue; }
    const isHead = k.classList.contains("pad") && !!k.querySelector(".sec-head");
    if (isHead || !cur) {
      cur = document.createElement("section");
      cur.className = "blk";
      root.insertBefore(cur, k);
    }
    cur.appendChild(k);
  }
}
