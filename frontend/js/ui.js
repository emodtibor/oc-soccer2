// frontend/js/ui.js
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function fmtSkill(n) { return `<span class="badge">skill ${n}</span>`; }
export function goalieBadge(is) { return is ? `<span class="badge">kapus</span>` : ""; }

export function toast(msg) {
  console.log(msg);
  // ide tehetsz később vizuális toastot
}
