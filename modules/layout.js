/** 纯函数：不访问 DOM，不更改输入项目，便于单元测试和后续更换装箱算法。 */
export function expandItems(items, mode = 'compact') {
  const expanded = [];
  for (const item of items) {
    const qty = Math.min(999, Math.max(1, Math.floor(Number(item.qty) || 1)));
    for (let i = 1; i <= qty; i++) expanded.push({ ...item, instanceId: `${item.id}-${i}` });
  }
  if (mode === 'compact') {
    expanded.sort((a, b) => (b.height * b.width) - (a.height * a.width) || b.height - a.height);
  }
  return expanded;
}

export function calculateLayout(state, paper) {
  const margin = Number(state.margin) || 0;
  const gap = Number(state.gap) || 0;
  const usableW = paper.width - 2 * margin;
  const usableH = paper.height - 2 * margin;
  const all = expandItems(state.items, state.layoutMode);
  const tooLarge = [];
  const items = all.filter(item => {
    const ok = item.width > 0 && item.height > 0 && item.width <= usableW + 1e-6 && item.height <= usableH + 1e-6;
    if (!ok) tooLarge.push(item);
    return ok;
  });
  const pages = [];
  let page = [];
  let x = margin, y = margin, rowH = 0;
  const flush = () => { if (page.length) pages.push(page); page = []; x = margin; y = margin; rowH = 0; };
  for (const item of items) {
    if (x + item.width > paper.width - margin + 1e-6) {
      x = margin;
      y += rowH + gap;
      rowH = 0;
    }
    if (y + item.height > paper.height - margin + 1e-6) flush();
    // Guard against corrupted/imported data: never silently place out of bounds.
    if (x + item.width > paper.width - margin + 1e-6 || y + item.height > paper.height - margin + 1e-6) {
      tooLarge.push(item);
      continue;
    }
    page.push({ ...item, x, y });
    x += item.width + gap;
    rowH = Math.max(rowH, item.height);
  }
  flush();
  return { pages, tooLarge, total: all.length };
}

/** 删除选中的副本，仅减少数量；数量归零后移除该素材。 */
export function removeSelectedCopies(items, selectedInstanceIds) {
  const selected = new Set(selectedInstanceIds);
  let removed = 0;
  const nextItems = [];
  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    let count = 0;
    for (let copy = 1; copy <= qty; copy++) {
      if (selected.has(`${item.id}-${copy}`)) count++;
    }
    removed += count;
    if (qty > count) nextItems.push({ ...item, qty: qty - count });
  }
  return { items: nextItems, removed };
}

export function selectedSourceIds(placements, selectedInstanceIds) {
  const set = new Set(selectedInstanceIds);
  return new Set(placements.filter(p => set.has(p.instanceId)).map(p => p.id));
}
