/** 预览页生成：容器先占位，图片内容由 IntersectionObserver 按需挂载。 */
export function createPageShell(paper, scale, pageIndex, pageCount, count) {
  const wrap = document.createElement('div');
  wrap.className = 'page-wrap';
  wrap.dataset.pageIndex = String(pageIndex);
  const label = document.createElement('div');
  label.className = 'page-label';
  label.textContent = `第 ${pageIndex + 1} / ${pageCount} 页 · ${count} 张`;
  const page = document.createElement('div');
  page.className = 'paper';
  page.style.width = `${paper.width * scale}px`;
  page.style.height = `${paper.height * scale}px`;
  wrap.append(label, page);
  return wrap;
}

function addCutMarks(sticker, scale) {
  const positions = [[-5,-5],[sticker.offsetWidth-5,-5],[-5,sticker.offsetHeight-5],[sticker.offsetWidth-5,sticker.offsetHeight-5]];
  positions.forEach(([left, top]) => {
    const mark = document.createElement('span');
    mark.className = 'cutmark';
    mark.style.left = `${left}px`;
    mark.style.top = `${top}px`;
    mark.style.transform = `scale(${Math.min(1, scale / 2.5)})`;
    sticker.appendChild(mark);
  });
}

export function populatePageShell(wrap, placements, opts) {
  if (wrap.dataset.populated === 'true') return;
  wrap.dataset.populated = 'true';
  const page = wrap.querySelector('.paper');
  placements.forEach((p, index) => {
    const sticker = document.createElement('div');
    sticker.className = `sticker ${opts.showBorder ? 'border-on' : ''} ${opts.selected.has(p.instanceId) ? 'sticker-selected' : ''}`;
    sticker.style.left = `${p.x * opts.scale}px`;
    sticker.style.top = `${p.y * opts.scale}px`;
    sticker.style.width = `${p.width * opts.scale}px`;
    sticker.style.height = `${p.height * opts.scale}px`;
    sticker.dataset.itemId = p.id;
    sticker.dataset.instanceId = p.instanceId;
    sticker.title = `选择贴纸：${p.name}`;
    sticker.tabIndex = 0;
    sticker.setAttribute('role','button');
    sticker.setAttribute('aria-label', `选择贴纸 ${p.name}`);
    const activate = e => opts.onSelect(e, p, index);
    sticker.addEventListener('click', activate);
    sticker.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e); }
    });
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    img.loading = 'lazy';
    img.style.objectFit = opts.fitMode;
    sticker.appendChild(img);
    if (opts.showCutMarks) addCutMarks(sticker, opts.scale);
    page.appendChild(sticker);
  });
}

export function scrollInside(container, target, behavior = 'smooth') {
  if (!container || !target) return;
  const box = container.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const desired = container.scrollTop + rect.top - box.top - (box.height - rect.height) / 2;
  container.scrollTo({ top: Math.max(0, desired), behavior });
}
