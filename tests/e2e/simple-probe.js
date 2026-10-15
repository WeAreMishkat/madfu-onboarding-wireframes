(() => {
  const nodes = [...document.querySelectorAll('.react-flow__node-screen')].map((n) => ({ id: n.getAttribute('data-id'), r: n.getBoundingClientRect() }));
  // Obstacles for arrows: the visible wireframe card and the title text (not the empty band around the title).
  const obstacles = [...document.querySelectorAll('.react-flow__node-screen')].flatMap((n) => [
    { id: n.getAttribute('data-id') + ' (card)', r: n.querySelector('[data-testid^="simple-open-"]').getBoundingClientRect() },
    { id: n.getAttribute('data-id') + ' (title)', r: n.querySelector('[data-role="title"]').getBoundingClientRect() },
  ]);
  const labels = [...document.querySelectorAll('[data-testid^="simple-label-"]')].map((l) => ({ id: l.getAttribute('data-testid'), r: l.getBoundingClientRect() }));
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const out = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if (inter(nodes[i].r, nodes[j].r) > 0) out.push(`screens overlap: ${nodes[i].id} / ${nodes[j].id}`);
  for (const l of labels) for (const n of nodes) if (inter(l.r, n.r) > 4) out.push(`label ${l.id} covers ${n.id}`);
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (inter(labels[i].r, labels[j].r) > 4) out.push(`labels overlap: ${labels[i].id} / ${labels[j].id}`);
  // Arrows must not pass through any screen (title + card), except where they start / end.
  for (const g of document.querySelectorAll('.react-flow__edge')) {
    const id = g.getAttribute('data-id') || g.getAttribute('data-testid') || '';
    const path = g.querySelector('path.react-flow__edge-path');
    if (!path) continue;
    const len = path.getTotalLength();
    const ctm = path.getScreenCTM();
    for (let d = 16; d < len - 16; d += 8) {
      const p = path.getPointAtLength(d).matrixTransform(ctm);
      for (const n of obstacles) if (p.x > n.r.left + 1 && p.x < n.r.right - 1 && p.y > n.r.top + 1 && p.y < n.r.bottom - 1) { out.push(`arrow ${id} passes through ${n.id}`); d = len; break; }
    }
  }
  return out;
})()
