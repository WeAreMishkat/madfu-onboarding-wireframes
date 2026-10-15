(() => {
  const nodes = [...document.querySelectorAll('.react-flow__node')].filter((n) => !/react-flow__node-(lane|header|assumptions)/.test(n.className)).map((n) => ({ id: n.getAttribute('data-id'), r: n.getBoundingClientRect() }));
  const labels = [...document.querySelectorAll('[data-testid^="board-edge-label-"]')].map((l) => ({ id: l.getAttribute('data-testid').replace('board-edge-label-', ''), r: l.getBoundingClientRect() }));
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const out = [];
  for (const l of labels) for (const n of nodes) { const a = inter(l.r, n.r); if (a > 20) out.push(`${l.id} x ${n.id} (${Math.round(a)}px2)`); }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = inter(labels[i].r, labels[j].r); if (a > 20) out.push(`label ${labels[i].id} x label ${labels[j].id}`); }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { if (inter(nodes[i].r, nodes[j].r) > 0) out.push(`node ${nodes[i].id} x node ${nodes[j].id}`); }
  return out;
})()
