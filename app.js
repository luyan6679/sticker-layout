const MM_TO_PX = 3.1;
const VERSION = 8;
let currentPage = 0;
let lastLayout = [];
let selectedAssetId = null;
const selectedItemIds = new Set();
let selectionAnchorIndex = null;
let mobileMultiSelectMode = false;
let mobileView = "preview";

const state = {
  paper: "A4",
  orientation: "portrait",
  margin: 8,
  gap: 3,
  defaultWidth: 50,
  defaultHeight: 50,
  fitMode: "contain",
  layoutMode: "compact",
  showBorder: true,
  showCutMarks: false,
  preserveAspectOnImport: true,
  batchSizingMode: "box",
  edgeSize: 50,
  items: []
};

const refs = {
  imageInput: document.getElementById("imageInput"),
  assetList: document.getElementById("assetList"),
  assetTemplate: document.getElementById("assetTemplate"),
  emptyHint: document.getElementById("emptyHint"),
  previewArea: document.getElementById("previewArea"),
  pageSummary: document.getElementById("pageSummary"),
  pageNav: document.getElementById("pageNav"),
  pageSelect: document.getElementById("pageSelect"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  layoutWarning: document.getElementById("layoutWarning"),
  paperSize: document.getElementById("paperSize"),
  orientation: document.getElementById("orientation"),
  marginInput: document.getElementById("marginInput"),
  gapInput: document.getElementById("gapInput"),
  layoutMode: document.getElementById("layoutMode"),
  defaultWidth: document.getElementById("defaultWidth"),
  defaultHeight: document.getElementById("defaultHeight"),
  fitMode: document.getElementById("fitMode"),
  showBorder: document.getElementById("showBorder"),
  showCutMarks: document.getElementById("showCutMarks"),
  preserveAspectOnImport: document.getElementById("preserveAspectOnImport"),
  batchSizingMode: document.getElementById("batchSizingMode"),
  edgeSizeField: document.getElementById("edgeSizeField"),
  edgeSizeLabel: document.getElementById("edgeSizeLabel"),
  edgeSizeInput: document.getElementById("edgeSizeInput"),
  batchSizingHint: document.getElementById("batchSizingHint"),
  applySizeToAllBtn: document.getElementById("applySizeToAllBtn"),
  autoLayoutBtn: document.getElementById("autoLayoutBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  loadProjectBtn: document.getElementById("loadProjectBtn"),
  exportProjectBtn: document.getElementById("exportProjectBtn"),
  importProjectBtn: document.getElementById("importProjectBtn"),
  projectFileInput: document.getElementById("projectFileInput"),
  printBtn: document.getElementById("printBtn"),
  selectionToolbar: document.getElementById("selectionToolbar"),
  selectionCount: document.getElementById("selectionCount"),
  selectPageBtn: document.getElementById("selectPageBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  selectedLongEdgeInput: document.getElementById("selectedLongEdgeInput"),
  applySelectedSizeBtn: document.getElementById("applySelectedSizeBtn"),
  mobileMultiSelectBtn: document.getElementById("mobileMultiSelectBtn"),
  mobileNav: document.getElementById("mobileNav")
};

function uid() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function safeNumber(value, fallback, min = 0, max = Infinity) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function getPaperSize() {
  let w = 210, h = 297;
  if (state.orientation === "landscape") [w, h] = [h, w];
  return { width: w, height: h };
}

function getAspectRatio(item) {
  if (item.originalWidth > 0 && item.originalHeight > 0) {
    return item.originalWidth / item.originalHeight;
  }
  if (item.width > 0 && item.height > 0) {
    return item.width / item.height;
  }
  return 1;
}

function fitSizeWithinBox(originalWidth, originalHeight, boxWidth, boxHeight) {
  if (!originalWidth || !originalHeight) {
    return { width: boxWidth, height: boxHeight };
  }
  const scale = Math.min(boxWidth / originalWidth, boxHeight / originalHeight);
  return {
    width: round2(originalWidth * scale),
    height: round2(originalHeight * scale)
  };
}

function sizeByEdge(item, edgeMode, edgeSize) {
  const ratio = getAspectRatio(item);

  if (edgeMode === "long") {
    if (ratio >= 1) {
      return { width: round2(edgeSize), height: round2(edgeSize / ratio) };
    }
    return { width: round2(edgeSize * ratio), height: round2(edgeSize) };
  }

  if (edgeMode === "short") {
    if (ratio >= 1) {
      return { width: round2(edgeSize * ratio), height: round2(edgeSize) };
    }
    return { width: round2(edgeSize), height: round2(edgeSize / ratio) };
  }

  return { width: item.width, height: item.height };
}

function fitLockedFromWidth(item, requestedWidth) {
  const ratio = getAspectRatio(item);
  let width = safeNumber(requestedWidth, item.width, 5, 200);
  let height = width / ratio;

  if (height > 280) {
    height = 280;
    width = height * ratio;
  }
  if (height < 5) {
    height = 5;
    width = height * ratio;
  }
  return {
    width: round2(Math.min(200, Math.max(5, width))),
    height: round2(Math.min(280, Math.max(5, height)))
  };
}

function fitLockedFromHeight(item, requestedHeight) {
  const ratio = getAspectRatio(item);
  let height = safeNumber(requestedHeight, item.height, 5, 280);
  let width = height * ratio;

  if (width > 200) {
    width = 200;
    height = width / ratio;
  }
  if (width < 5) {
    width = 5;
    height = width / ratio;
  }
  return {
    width: round2(Math.min(200, Math.max(5, width))),
    height: round2(Math.min(280, Math.max(5, height)))
  };
}

function canvasToDataURL(canvas, type = "image/webp", quality = 0.88) {
  return canvas.toDataURL(type, quality);
}

function loadFileImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = err => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}

function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

async function optimizeImage(file) {
  const { img, url } = await loadFileImage(file);
  try {
    const ow = img.naturalWidth;
    const oh = img.naturalHeight;
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(ow, oh));
    const w = Math.max(1, Math.round(ow * scale));
    const h = Math.max(1, Math.round(oh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d", { alpha: true }).drawImage(img, 0, 0, w, h);
    const src = canvasToDataURL(canvas, "image/webp", 0.88);

    const thumbScale = Math.min(1, 180 / Math.max(ow, oh));
    const tw = Math.max(1, Math.round(ow * thumbScale));
    const th = Math.max(1, Math.round(oh * thumbScale));
    const thumb = document.createElement("canvas");
    thumb.width = tw;
    thumb.height = th;
    thumb.getContext("2d", { alpha: true }).drawImage(img, 0, 0, tw, th);
    const thumbSrc = canvasToDataURL(thumb, "image/webp", 0.72);

    canvas.width = canvas.height = 1;
    thumb.width = thumb.height = 1;
    return { src, thumbSrc, width: ow, height: oh };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function handleImages(files) {
  syncStateFromControls();
  const imageFiles = [...files].filter(f => /^image\/(png|jpeg|webp)$/i.test(f.type));

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const optimized = await optimizeImage(file);

    let width = state.defaultWidth;
    let height = state.defaultHeight;
    if (state.preserveAspectOnImport) {
      const fitted = fitSizeWithinBox(
        optimized.width,
        optimized.height,
        state.defaultWidth,
        state.defaultHeight
      );
      width = fitted.width;
      height = fitted.height;
    }

    state.items.push({
      id: uid(),
      name: file.name,
      src: optimized.src,
      thumbSrc: optimized.thumbSrc,
      qty: 1,
      width,
      height,
      originalWidth: optimized.width,
      originalHeight: optimized.height,
      aspectLocked: true
    });

    // 每 10 张让浏览器有机会释放上一张图片的解码内存，并更新素材列表。
    if ((i + 1) % 10 === 0) {
      renderAssets();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  render();
}

function createAssetCard(item) {
  const node = refs.assetTemplate.content.firstElementChild.cloneNode(true);
  const img = node.querySelector(".asset-thumb");
  const name = node.querySelector(".asset-name");
  const qty = node.querySelector(".qty-input");
  const width = node.querySelector(".width-input");
  const height = node.querySelector(".height-input");
  const lock = node.querySelector(".lock-ratio-input");
  const remove = node.querySelector(".remove-btn");

  if (item.aspectLocked == null) item.aspectLocked = true;

  node.dataset.itemId = item.id;
  if (selectedAssetId === item.id) node.classList.add("asset-card-selected");
  if (selectedItemIds.has(item.id)) node.classList.add("asset-card-multi-selected");

  img.src = item.thumbSrc || item.src;
  name.textContent = item.name;
  name.title = item.name;
  qty.value = item.qty;
  width.value = item.width;
  height.value = item.height;
  lock.checked = item.aspectLocked;

  qty.addEventListener("input", () => {
    item.qty = Math.max(1, Math.floor(safeNumber(qty.value, 1, 1, 999)));
    renderPreviewOnly();
  });

  width.addEventListener("input", () => {
    if (item.aspectLocked) {
      const next = fitLockedFromWidth(item, width.value);
      item.width = next.width;
      item.height = next.height;
      width.value = item.width;
      height.value = item.height;
    } else {
      item.width = safeNumber(width.value, state.defaultWidth, 5, 200);
    }
    renderPreviewOnly();
  });

  height.addEventListener("input", () => {
    if (item.aspectLocked) {
      const next = fitLockedFromHeight(item, height.value);
      item.width = next.width;
      item.height = next.height;
      width.value = item.width;
      height.value = item.height;
    } else {
      item.height = safeNumber(height.value, state.defaultHeight, 5, 280);
    }
    renderPreviewOnly();
  });

  lock.addEventListener("change", () => {
    item.aspectLocked = lock.checked;
    if (item.aspectLocked) {
      const next = fitLockedFromWidth(item, item.width);
      item.width = next.width;
      item.height = next.height;
      width.value = item.width;
      height.value = item.height;
      renderPreviewOnly();
    }
  });

  // 删除按钮由素材列表统一事件委托处理，避免和预览多选/卡片定位事件互相干扰。
  remove.dataset.itemId = item.id;

  return node;
}

function deleteAssetById(itemId) {
  const index = state.items.findIndex(item => item.id === itemId);
  if (index < 0) return;

  state.items.splice(index, 1);

  if (selectedAssetId === itemId) {
    selectedAssetId = null;
  }

  selectedItemIds.delete(itemId);

  // 当前页可能因为删除素材而消失，所以重新约束页码。
  const { pages } = layoutPages();
  if (currentPage >= pages.length) {
    currentPage = Math.max(0, pages.length - 1);
  }

  render();
  updateSelectionUI();
}

// 左侧素材列表使用事件委托处理删除。
// stopPropagation 可确保点击“×”只执行删除，不会触发卡片选中/定位。
refs.assetList.addEventListener("pointerdown", event => {
  const button = event.target.closest(".remove-btn");
  if (!button) return;
  event.stopPropagation();
});

refs.assetList.addEventListener("click", event => {
  const button = event.target.closest(".remove-btn");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();

  const itemId = button.dataset.itemId || button.closest(".asset-card")?.dataset.itemId;
  if (!itemId) return;

  deleteAssetById(itemId);
});

function isMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function setMobileView(view, options = {}) {
  mobileView = ["assets", "preview", "settings"].includes(view) ? view : "preview";

  document.body.classList.remove(
    "mobile-view-assets",
    "mobile-view-preview",
    "mobile-view-settings"
  );
  document.body.classList.add(`mobile-view-${mobileView}`);

  document.querySelectorAll(".mobile-nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.mobileView === mobileView);
  });

  if (mobileView === "preview" && !options.skipRender) {
    requestAnimationFrame(() => renderPreviewOnly());
  }
}

function setMobileMultiSelectMode(enabled) {
  mobileMultiSelectMode = !!enabled;
  if (!refs.mobileMultiSelectBtn) return;

  refs.mobileMultiSelectBtn.setAttribute("aria-pressed", String(mobileMultiSelectMode));
  refs.mobileMultiSelectBtn.textContent = mobileMultiSelectMode ? "完成多选" : "多选模式";

  if (!mobileMultiSelectMode) {
    selectionAnchorIndex = null;
  }
}

function getPreviewScale(paper) {
  if (!isMobileLayout()) return MM_TO_PX;

  const areaWidth = refs.previewArea?.clientWidth || window.innerWidth;
  const availableWidth = Math.max(250, areaWidth - 18);
  return Math.min(MM_TO_PX, availableWidth / paper.width);
}

function focusAssetCard(itemId) {
  selectedAssetId = itemId;

  const revealTarget = () => {
    document.querySelectorAll(".asset-card-selected").forEach(card => {
      card.classList.remove("asset-card-selected");
    });

    const cards = [...refs.assetList.querySelectorAll(".asset-card")];
    const target = cards.find(card => card.dataset.itemId === itemId);
    if (!target) return;

    target.classList.add("asset-card-selected");
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    target.classList.remove("asset-card-flash");
    void target.offsetWidth;
    target.classList.add("asset-card-flash");
    window.setTimeout(() => target.classList.remove("asset-card-flash"), 900);
  };

  if (isMobileLayout() && !mobileMultiSelectMode) {
    setMobileView("assets", { skipRender: true });
    requestAnimationFrame(() => requestAnimationFrame(revealTarget));
  } else {
    revealTarget();
  }
}

function updateSelectionUI() {
  const count = selectedItemIds.size;
  refs.selectionCount.textContent = count;
  refs.selectionToolbar.classList.toggle("hidden", count === 0);

  document.querySelectorAll(".sticker[data-item-id]").forEach(sticker => {
    sticker.classList.toggle("sticker-selected", selectedItemIds.has(sticker.dataset.itemId));
  });

  refs.assetList.querySelectorAll(".asset-card[data-item-id]").forEach(card => {
    card.classList.toggle("asset-card-multi-selected", selectedItemIds.has(card.dataset.itemId));
  });
}

function clearPreviewSelection() {
  selectedItemIds.clear();
  selectionAnchorIndex = null;
  updateSelectionUI();
}

function selectCurrentPage() {
  const placements = lastLayout[currentPage] || [];
  placements.forEach(p => selectedItemIds.add(p.id));
  selectionAnchorIndex = placements.length ? placements.length - 1 : null;
  updateSelectionUI();
}

function handleStickerSelection(event, itemId, placementIndex) {
  const mobileAdditive = isMobileLayout() && mobileMultiSelectMode;
  const additive = event.ctrlKey || event.metaKey || mobileAdditive;
  const range = !isMobileLayout() && event.shiftKey && selectionAnchorIndex != null;
  const placements = lastLayout[currentPage] || [];

  if (range) {
    if (!additive) selectedItemIds.clear();
    const start = Math.min(selectionAnchorIndex, placementIndex);
    const end = Math.max(selectionAnchorIndex, placementIndex);
    for (let i = start; i <= end; i++) {
      if (placements[i]) selectedItemIds.add(placements[i].id);
    }
  } else if (additive) {
    if (selectedItemIds.has(itemId)) {
      selectedItemIds.delete(itemId);
    } else {
      selectedItemIds.add(itemId);
    }
    selectionAnchorIndex = placementIndex;
  } else {
    if (selectedItemIds.size === 1 && selectedItemIds.has(itemId)) {
      selectedItemIds.clear();
      selectionAnchorIndex = null;
    } else {
      selectedItemIds.clear();
      selectedItemIds.add(itemId);
      selectionAnchorIndex = placementIndex;
    }
  }

  if (selectedItemIds.has(itemId)) {
    focusAssetCard(itemId);
  }
  updateSelectionUI();
}

function applyLongEdgeToSelection(sizeMm) {
  const size = safeNumber(sizeMm, 50, 5, 280);
  if (!selectedItemIds.size) return;

  state.items.forEach(item => {
    if (!selectedItemIds.has(item.id)) return;
    const next = sizeByEdge(item, "long", size);
    item.width = next.width;
    item.height = next.height;
    item.aspectLocked = true;
  });

  renderAssets();
  renderPreviewOnly();
  updateSelectionUI();
}

function scaleSelection(factor) {
  if (!selectedItemIds.size) return;

  state.items.forEach(item => {
    if (!selectedItemIds.has(item.id)) return;

    let applied = Number(factor);
    if (!Number.isFinite(applied) || applied <= 0) return;

    if (applied >= 1) {
      applied = Math.min(applied, 200 / item.width, 280 / item.height);
    } else {
      applied = Math.max(applied, 5 / item.width, 5 / item.height);
    }

    item.width = round2(item.width * applied);
    item.height = round2(item.height * applied);
    item.aspectLocked = true;
  });

  renderAssets();
  renderPreviewOnly();
  updateSelectionUI();
}

function renderAssets() {
  refs.assetList.innerHTML = "";
  refs.emptyHint.style.display = state.items.length ? "none" : "block";
  for (const item of state.items) {
    refs.assetList.appendChild(createAssetCard(item));
  }
}

function expandItems() {
  const expanded = [];

  for (const item of state.items) {
    for (let i = 0; i < item.qty; i++) {
      expanded.push({
        ...item,
        instanceId: `${item.id}-${i + 1}`
      });
    }
  }

  if (state.layoutMode === "compact") {
    expanded.sort((a, b) =>
      (b.height * b.width) - (a.height * a.width) ||
      b.height - a.height
    );
  }

  return expanded;
}

function layoutPages() {
  const paper = getPaperSize();
  const margin = state.margin;
  const gap = state.gap;
  const usableW = paper.width - margin * 2;
  const usableH = paper.height - margin * 2;

  const tooLarge = [];
  const items = expandItems().filter(item => {
    const ok = item.width <= usableW && item.height <= usableH;
    if (!ok) tooLarge.push(item);
    return ok;
  });

  const pages = [];
  let page = [];
  let x = margin;
  let y = margin;
  let rowH = 0;

  const pushPage = () => {
    if (page.length) pages.push(page);
    page = [];
    x = margin;
    y = margin;
    rowH = 0;
  };

  for (const item of items) {
    if (x + item.width > paper.width - margin + 0.0001) {
      x = margin;
      y += rowH + gap;
      rowH = 0;
    }

    if (y + item.height > paper.height - margin + 0.0001) {
      pushPage();
    }

    if (x + item.width > paper.width - margin + 0.0001) {
      tooLarge.push(item);
      continue;
    }

    page.push({ ...item, x, y });

    x += item.width + gap;
    rowH = Math.max(rowH, item.height);
  }

  pushPage();
  return { pages, tooLarge };
}

function addCutMarks(sticker, scale) {
  const positions = [
    [-5, -5],
    [sticker.offsetWidth - 5, -5],
    [-5, sticker.offsetHeight - 5],
    [sticker.offsetWidth - 5, sticker.offsetHeight - 5]
  ];

  positions.forEach(([left, top]) => {
    const mark = document.createElement("span");
    mark.className = "cutmark";
    mark.style.left = `${left}px`;
    mark.style.top = `${top}px`;
    mark.style.transform = `scale(${Math.min(1, scale / 2.5)})`;
    sticker.appendChild(mark);
  });
}

function updatePageNav(pages) {
  const count = pages.length;
  if (currentPage >= count) currentPage = Math.max(0, count - 1);
  refs.pageNav.classList.toggle("hidden", count <= 1);
  refs.pageSelect.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `第 ${i + 1} / ${count} 页`;
    refs.pageSelect.appendChild(option);
  }
  refs.pageSelect.value = currentPage;
  refs.prevPageBtn.disabled = currentPage <= 0;
  refs.nextPageBtn.disabled = currentPage >= count - 1;
}

function renderPreviewOnly() {
  const { pages, tooLarge } = layoutPages();
  lastLayout = pages;

  refs.previewArea.innerHTML = "";
  const total = expandItems().length;
  refs.pageSummary.textContent = `${total} 张贴纸 · ${pages.length} 页 · ${state.items.length} 个图片文件`;
  refs.layoutWarning.textContent = tooLarge.length
    ? `有 ${tooLarge.length} 张尺寸超过当前纸张可用范围，未排入。`
    : "";

  updatePageNav(pages);

  if (!state.items.length) {
    refs.previewArea.innerHTML = `<div class="preview-placeholder">上传图片后，这里会显示当前 A4 页面。</div>`;
    return;
  }

  if (!pages.length) {
    refs.previewArea.innerHTML = `<div class="preview-placeholder">当前图片尺寸无法放入纸张，请减小贴纸尺寸或页边距。</div>`;
    return;
  }

  const paper = getPaperSize();
  const scale = getPreviewScale(paper);
  const placements = pages[currentPage];

  const wrap = document.createElement("div");
  wrap.className = "page-wrap";

  const label = document.createElement("div");
  label.className = "page-label";
  label.textContent = `第 ${currentPage + 1} / ${pages.length} 页 · 本页 ${placements.length} 张`;

  const page = document.createElement("div");
  page.className = "paper";
  page.style.width = `${paper.width * scale}px`;
  page.style.height = `${paper.height * scale}px`;

  placements.forEach((p, placementIndex) => {
    const sticker = document.createElement("div");
    sticker.className = `sticker ${state.showBorder ? "border-on" : ""} ${selectedItemIds.has(p.id) ? "sticker-selected" : ""}`;
    sticker.style.left = `${p.x * scale}px`;
    sticker.style.top = `${p.y * scale}px`;
    sticker.style.width = `${p.width * scale}px`;
    sticker.style.height = `${p.height * scale}px`;
    sticker.dataset.itemId = p.id;
    sticker.title = `点击选择并定位素材：${p.name}`;
    sticker.tabIndex = 0;
    sticker.setAttribute("role", "button");
    sticker.setAttribute("aria-label", `定位到素材 ${p.name}`);

    const activateSticker = event => handleStickerSelection(event, p.id, placementIndex);
    sticker.addEventListener("click", activateSticker);
    sticker.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleStickerSelection(event, p.id, placementIndex);
      }
    });

    const img = document.createElement("img");
    img.src = p.src;
    img.alt = p.name;
    img.loading = "lazy";
    img.style.objectFit = state.fitMode;
    sticker.appendChild(img);

    if (state.showCutMarks) addCutMarks(sticker, scale);
    page.appendChild(sticker);
  });

  wrap.append(label, page);
  refs.previewArea.appendChild(wrap);
}

function render() {
  renderAssets();
  renderPreviewOnly();
}

function updateBatchSizingUI() {
  const mode = refs.batchSizingMode.value;
  const useEdge = mode === "long" || mode === "short";

  refs.edgeSizeField.classList.toggle("hidden", !useEdge);

  if (mode === "long") {
    refs.edgeSizeLabel.textContent = "长边尺寸（mm）";
    refs.batchSizingHint.textContent =
      "所有图片的最长边统一为指定尺寸，另一边按原图比例自动计算。";
  } else if (mode === "short") {
    refs.edgeSizeLabel.textContent = "短边尺寸（mm）";
    refs.batchSizingHint.textContent =
      "所有图片的最短边统一为指定尺寸，另一边按原图比例自动计算。";
  } else {
    refs.batchSizingHint.textContent =
      "按默认宽高尺寸框等比缩放，图片不会被拉伸或裁成正方形。";
  }
}

function syncStateFromControls() {
  state.orientation = refs.orientation.value;
  state.margin = safeNumber(refs.marginInput.value, 8, 0, 30);
  state.gap = safeNumber(refs.gapInput.value, 3, 0, 30);
  state.layoutMode = refs.layoutMode.value;
  state.defaultWidth = safeNumber(refs.defaultWidth.value, 50, 5, 200);
  state.defaultHeight = safeNumber(refs.defaultHeight.value, 50, 5, 280);
  state.fitMode = refs.fitMode.value;
  state.showBorder = refs.showBorder.checked;
  state.showCutMarks = refs.showCutMarks.checked;
  state.preserveAspectOnImport = refs.preserveAspectOnImport.checked;
  state.batchSizingMode = refs.batchSizingMode.value;
  state.edgeSize = safeNumber(refs.edgeSizeInput.value, 50, 5, 280);
}

function syncControlsFromState() {
  refs.orientation.value = state.orientation;
  refs.marginInput.value = state.margin;
  refs.gapInput.value = state.gap;
  refs.layoutMode.value = state.layoutMode;
  refs.defaultWidth.value = state.defaultWidth;
  refs.defaultHeight.value = state.defaultHeight;
  refs.fitMode.value = state.fitMode || "contain";
  refs.showBorder.checked = state.showBorder;
  refs.showCutMarks.checked = state.showCutMarks;
  refs.preserveAspectOnImport.checked = state.preserveAspectOnImport !== false;
  refs.batchSizingMode.value = state.batchSizingMode || "box";
  refs.edgeSizeInput.value = state.edgeSize || 50;
  updateBatchSizingUI();
}

[
  "orientation",
  "marginInput",
  "gapInput",
  "layoutMode",
  "defaultWidth",
  "defaultHeight",
  "fitMode",
  "showBorder",
  "showCutMarks",
  "preserveAspectOnImport",
  "edgeSizeInput"
].forEach(key => {
  refs[key].addEventListener("input", () => {
    syncStateFromControls();
    if (key === "defaultWidth" || key === "defaultHeight") {
      document.querySelectorAll(".preset").forEach(btn => btn.classList.remove("active"));
    }
    renderPreviewOnly();
  });
});

refs.batchSizingMode.addEventListener("change", () => {
  syncStateFromControls();
  updateBatchSizingUI();
});

document.querySelectorAll(".preset").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".preset").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.defaultWidth = Number(btn.dataset.w);
    state.defaultHeight = Number(btn.dataset.h);
    syncControlsFromState();
  });
});

refs.imageInput.addEventListener("change", async e => {
  await handleImages(e.target.files);
  refs.imageInput.value = "";
});

refs.applySizeToAllBtn.addEventListener("click", () => {
  syncStateFromControls();

  state.items.forEach(item => {
    let next;

    if (state.batchSizingMode === "long" || state.batchSizingMode === "short") {
      next = sizeByEdge(item, state.batchSizingMode, state.edgeSize);
    } else {
      const ratio = getAspectRatio(item);
      next = fitSizeWithinBox(
        ratio,
        1,
        state.defaultWidth,
        state.defaultHeight
      );
    }

    item.width = next.width;
    item.height = next.height;
    item.aspectLocked = true;
  });

  render();
});

refs.pageSelect.addEventListener("change", () => {
  currentPage = Number(refs.pageSelect.value);
  selectionAnchorIndex = null;
  renderPreviewOnly();
  updateSelectionUI();
});

refs.prevPageBtn.addEventListener("click", () => {
  if (currentPage > 0) currentPage--;
  selectionAnchorIndex = null;
  renderPreviewOnly();
  updateSelectionUI();
});

refs.nextPageBtn.addEventListener("click", () => {
  if (currentPage < lastLayout.length - 1) currentPage++;
  selectionAnchorIndex = null;
  renderPreviewOnly();
  updateSelectionUI();
});

refs.autoLayoutBtn.addEventListener("click", () => {
  syncStateFromControls();
  renderPreviewOnly();
});

function serializeState() {
  syncStateFromControls();
  return JSON.stringify({
    version: VERSION,
    savedAt: new Date().toISOString(),
    state
  });
}

async function enrichOriginalDimensions() {
  let changed = false;

  for (const item of state.items) {
    if ((!item.originalWidth || !item.originalHeight) && item.src) {
      try {
        const dims = await getImageDimensions(item.src);
        item.originalWidth = dims.width;
        item.originalHeight = dims.height;
        changed = true;
      } catch (_) {
        // Keep current size ratio as fallback.
      }
    }

    if (item.aspectLocked == null) {
      item.aspectLocked = true;
      changed = true;
    }
  }

  if (changed) render();
}

function restoreSerialized(text) {
  const data = JSON.parse(text);
  const incoming = data.state || data;

  if (!incoming || !Array.isArray(incoming.items)) {
    throw new Error("项目文件格式不正确");
  }

  if (incoming.fitMode == null) incoming.fitMode = "contain";
  if (incoming.preserveAspectOnImport == null) incoming.preserveAspectOnImport = true;
  if (incoming.batchSizingMode == null) incoming.batchSizingMode = "box";
  if (incoming.edgeSize == null) incoming.edgeSize = 50;

  Object.assign(state, incoming);
  syncControlsFromState();
  render();
  enrichOriginalDimensions();
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("a4-sticker-layout-db", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveRecentProject() {
  const db = await openDB();
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").put(serializeState(), "recent");

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  alert("已保存为最近项目。");
}

async function loadRecentProject() {
  const db = await openDB();
  const tx = db.transaction("projects", "readonly");
  const request = tx.objectStore("projects").get("recent");

  const text = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!text) {
    alert("还没有保存过项目。");
    return;
  }

  restoreSerialized(text);
}

refs.saveProjectBtn.addEventListener("click", () =>
  saveRecentProject().catch(err => alert("保存失败：" + err.message))
);

refs.loadProjectBtn.addEventListener("click", () =>
  loadRecentProject().catch(err => alert("恢复失败：" + err.message))
);

refs.exportProjectBtn.addEventListener("click", () => {
  const blob = new Blob([serializeState()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `贴纸排版项目_${new Date().toISOString().slice(0, 10)}.stickerproj`;
  a.click();
  URL.revokeObjectURL(a.href);
});

refs.importProjectBtn.addEventListener("click", () => refs.projectFileInput.click());

refs.projectFileInput.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    restoreSerialized(await file.text());
  } catch (err) {
    alert("导入失败：" + err.message);
  } finally {
    refs.projectFileInput.value = "";
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

function buildPrintHTML() {
  const { pages, tooLarge } = layoutPages();

  if (!pages.length) {
    throw new Error("当前没有可打印内容。");
  }

  if (tooLarge.length) {
    const ok = confirm(
      `有 ${tooLarge.length} 张贴纸尺寸过大未排入，仍要继续打印其余内容吗？`
    );
    if (!ok) throw new Error("已取消打印。");
  }

  const paper = getPaperSize();
  const pageCss = `${paper.width}mm ${paper.height}mm`;

  const pagesHtml = pages.map(placements => {
    const itemsHtml = placements.map(p => `
      <div class="sticker ${state.showBorder ? "border-on" : ""}" style="
        left:${p.x}mm;top:${p.y}mm;width:${p.width}mm;height:${p.height}mm;">
        <img src="${p.src}" alt="${escapeHtml(p.name)}" style="object-fit:${state.fitMode}" />
        ${state.showCutMarks ? `
          <i class="cut c1"></i><i class="cut c2"></i><i class="cut c3"></i><i class="cut c4"></i>
        ` : ""}
      </div>
    `).join("");

    return `<section class="print-page">${itemsHtml}</section>`;
  }).join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>A4 贴纸打印</title>
<style>
  @page { size: ${pageCss}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: white; }
  .print-page {
    position: relative;
    width: ${paper.width}mm;
    height: ${paper.height}mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    background: white;
  }
  .print-page:last-child { page-break-after: auto; break-after: auto; }
  .sticker { position: absolute; overflow: visible; }
  .sticker.border-on { outline: .2mm dashed #777; outline-offset: -.2mm; }
  .sticker img { width: 100%; height: 100%; display: block; }
  .cut {
    position: absolute;
    width: 3mm;
    height: 3mm;
  }
  .cut::before, .cut::after {
    content: "";
    position: absolute;
    background: #000;
  }
  .cut::before { width: 3mm; height: .2mm; left: 0; top: 1.4mm; }
  .cut::after { width: .2mm; height: 3mm; left: 1.4mm; top: 0; }
  .c1 { left: -1.5mm; top: -1.5mm; }
  .c2 { right: -1.5mm; top: -1.5mm; }
  .c3 { left: -1.5mm; bottom: -1.5mm; }
  .c4 { right: -1.5mm; bottom: -1.5mm; }
  @media screen {
    body { background: #ddd; padding: 10mm 0; }
    .print-page {
      margin: 0 auto 8mm;
      box-shadow: 0 0 8mm rgba(0,0,0,.18);
    }
  }
</style>
</head>
<body>
${pagesHtml}
<script>
  window.addEventListener("load", () => {
    setTimeout(() => window.print(), 250);
  });
<\/script>
</body>
</html>`;
}

refs.printBtn.addEventListener("click", () => {
  syncStateFromControls();

  try {
    const win = window.open("", "_blank");

    if (!win) {
      alert("浏览器拦截了打印窗口，请允许此网页打开弹窗后再试。");
      return;
    }

    win.document.open();
    win.document.write(buildPrintHTML());
    win.document.close();
  } catch (err) {
    if (err.message !== "已取消打印。") {
      alert(err.message);
    }
  }
});

refs.selectPageBtn.addEventListener("click", selectCurrentPage);
refs.clearSelectionBtn.addEventListener("click", clearPreviewSelection);

document.querySelectorAll(".quick-size-btn").forEach(button => {
  button.addEventListener("click", () => {
    refs.selectedLongEdgeInput.value = button.dataset.mm;
    applyLongEdgeToSelection(button.dataset.mm);
  });
});

refs.applySelectedSizeBtn.addEventListener("click", () => {
  applyLongEdgeToSelection(refs.selectedLongEdgeInput.value);
});

refs.selectedLongEdgeInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyLongEdgeToSelection(refs.selectedLongEdgeInput.value);
  }
});

document.querySelectorAll(".scale-selected-btn").forEach(button => {
  button.addEventListener("click", () => scaleSelection(button.dataset.scale));
});

if (refs.mobileNav) {
  refs.mobileNav.addEventListener("click", event => {
    const button = event.target.closest(".mobile-nav-btn");
    if (!button) return;
    setMobileView(button.dataset.mobileView);
  });
}

if (refs.mobileMultiSelectBtn) {
  refs.mobileMultiSelectBtn.addEventListener("click", () => {
    setMobileMultiSelectMode(!mobileMultiSelectMode);
  });
}

window.addEventListener("resize", () => {
  if (isMobileLayout()) {
    document.body.classList.add(`mobile-view-${mobileView}`);
  } else {
    document.body.classList.remove(
      "mobile-view-assets",
      "mobile-view-preview",
      "mobile-view-settings"
    );
    setMobileMultiSelectMode(false);
  }

  window.clearTimeout(window.__stickerResizeTimer);
  window.__stickerResizeTimer = window.setTimeout(() => {
    if (!isMobileLayout() || mobileView === "preview") {
      renderPreviewOnly();
    }
  }, 100);
});

if (isMobileLayout()) {
  setMobileView("preview", { skipRender: true });
}

syncControlsFromState();
render();
updateSelectionUI();
