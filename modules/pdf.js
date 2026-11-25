// 浏览器端 PDF 文件生成器，不依赖外部 CDN。
const PDF_PT_PER_MM = 72 / 25.4;

function asciiBytes(text) {
  return new TextEncoder().encode(text);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("图片数据格式不正确。");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片读取失败。"));
    img.src = src;
  });
}

async function renderStickerJpeg(item, widthMm, heightMm, fitMode) {
  const img = await loadImageElement(item.src);
  const pxPerMm = 300 / 25.4;
  const targetW = Math.max(16, Math.min(2200, Math.round(widthMm * pxPerMm)));
  const targetH = Math.max(16, Math.min(2200, Math.round(heightMm * pxPerMm)));
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);

  const srcW = img.naturalWidth || item.originalWidth || targetW;
  const srcH = img.naturalHeight || item.originalHeight || targetH;

  if (fitMode === "fill") {
    ctx.drawImage(img, 0, 0, targetW, targetH);
  } else {
    const scale = fitMode === "cover"
      ? Math.max(targetW / srcW, targetH / srcH)
      : Math.min(targetW / srcW, targetH / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const dx = (targetW - drawW) / 2;
    const dy = (targetH - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
  canvas.width = 1;
  canvas.height = 1;
  return {
    bytes: dataUrlToBytes(dataUrl),
    width: targetW,
    height: targetH
  };
}

function formatPdfNumber(value) {
  return Number(value.toFixed(4)).toString();
}

function pdfLine(x1, y1, x2, y2) {
  return `${formatPdfNumber(x1)} ${formatPdfNumber(y1)} m ${formatPdfNumber(x2)} ${formatPdfNumber(y2)} l S\n`;
}

export async function buildPdfBlob({ state, pages, tooLarge, paper, onProgress = () => {} }) {
  if (!pages.length) throw new Error("当前没有可导出的内容。");

  if (tooLarge.length) {
    const ok = confirm(`有 ${tooLarge.length} 张贴纸尺寸过大未排入，仍要继续导出其余内容吗？`);
    if (!ok) throw new Error("已取消导出。");
  }

  const paperW = paper.width * PDF_PT_PER_MM;
  const paperH = paper.height * PDF_PT_PER_MM;
  const itemById = new Map(state.items.map(item => [item.id, item]));
  const renderCache = new Map();

  const uniqueKeys = [];
  const seenKeys = new Set();
  pages.flat().forEach(p => {
    const key = `${p.id}|${p.width}|${p.height}|${state.fitMode}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueKeys.push({ key, placement: p });
    }
  });

  const renderedImages = new Map();
  for (let i = 0; i < uniqueKeys.length; i++) {
    const { key, placement } = uniqueKeys[i];
    const item = itemById.get(placement.id) || placement;
    onProgress(`正在准备图片 ${i + 1} / ${uniqueKeys.length}…`);
    let rendered = renderCache.get(key);
    if (!rendered) {
      rendered = await renderStickerJpeg(item, placement.width, placement.height, state.fitMode);
      renderCache.set(key, rendered);
    }
    renderedImages.set(key, rendered);
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const objects = [];
  const reserveObject = () => {
    objects.push(null);
    return objects.length;
  };
  const setObject = (id, content) => { objects[id - 1] = content; };
  const addObject = content => {
    const id = reserveObject();
    setObject(id, content);
    return id;
  };

  const catalogId = reserveObject();
  const pagesId = reserveObject();
  const imageObjectIds = new Map();

  for (const { key } of uniqueKeys) {
    const image = renderedImages.get(key);
    const header = asciiBytes(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`
    );
    const footer = asciiBytes("\nendstream");
    imageObjectIds.set(key, addObject(concatBytes([header, image.bytes, footer])));
  }

  const pageIds = [];
  pages.forEach((placements, pageIndex) => {
    onProgress(`正在生成 PDF 第 ${pageIndex + 1} / ${pages.length} 页…`);
    const resourceNames = new Map();
    let content = "";

    placements.forEach((p, index) => {
      const key = `${p.id}|${p.width}|${p.height}|${state.fitMode}`;
      if (!resourceNames.has(key)) resourceNames.set(key, `Im${resourceNames.size + 1}`);
      const imageName = resourceNames.get(key);
      const x = p.x * PDF_PT_PER_MM;
      const y = (paper.height - p.y - p.height) * PDF_PT_PER_MM;
      const w = p.width * PDF_PT_PER_MM;
      const h = p.height * PDF_PT_PER_MM;

      content += `q\n${formatPdfNumber(w)} 0 0 ${formatPdfNumber(h)} ${formatPdfNumber(x)} ${formatPdfNumber(y)} cm\n/${imageName} Do\nQ\n`;

      if (state.showBorder) {
        const lineWidth = 0.2 * PDF_PT_PER_MM;
        content += `q\n[${formatPdfNumber(1.2 * PDF_PT_PER_MM)} ${formatPdfNumber(1.2 * PDF_PT_PER_MM)}] 0 d\n`;
        content += `${formatPdfNumber(lineWidth)} w\n0.45 G\n`;
        content += `${formatPdfNumber(x)} ${formatPdfNumber(y)} ${formatPdfNumber(w)} ${formatPdfNumber(h)} re S\nQ\n`;
      }

      if (state.showCutMarks) {
        const half = 1.5 * PDF_PT_PER_MM;
        const lw = 0.2 * PDF_PT_PER_MM;
        const corners = [
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h]
        ];
        content += `q\n0 G\n${formatPdfNumber(lw)} w\n`;
        corners.forEach(([cx, cy]) => {
          content += pdfLine(cx - half, cy, cx + half, cy);
          content += pdfLine(cx, cy - half, cx, cy + half);
        });
        content += "Q\n";
      }
    });

    const contentBytes = asciiBytes(content);
    const contentObj = concatBytes([
      asciiBytes(`<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      asciiBytes("endstream")
    ]);
    const contentId = addObject(contentObj);

    const xObjects = [...resourceNames.entries()]
      .map(([key, name]) => `/${name} ${imageObjectIds.get(key)} 0 R`)
      .join(" ");
    const pageId = addObject(asciiBytes(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${formatPdfNumber(paperW)} ${formatPdfNumber(paperH)}] ` +
      `/Resources << /XObject << ${xObjects} >> >> /Contents ${contentId} 0 R >>`
    ));
    pageIds.push(pageId);
  });

  setObject(
    pagesId,
    asciiBytes(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`)
  );
  setObject(catalogId, asciiBytes(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`));

  const header = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]);
  const chunks = [header];
  const offsets = [0];
  let cursor = header.length;

  objects.forEach((objectContent, index) => {
    const id = index + 1;
    const prefix = asciiBytes(`${id} 0 obj\n`);
    const suffix = asciiBytes("\nendobj\n");
    offsets[id] = cursor;
    chunks.push(prefix, objectContent, suffix);
    cursor += prefix.length + objectContent.length + suffix.length;
  });

  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id++) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(asciiBytes(xref));

  onProgress("PDF 已生成，正在开始下载…");
  return new Blob(chunks, { type: "application/pdf" });
}

