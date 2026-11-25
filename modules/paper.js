/** 纸张规格：全部使用毫米。切换纸型不会改变任何贴纸的宽高。 */
export const PAPER_PRESETS = Object.freeze([
  { id: 'A3', label: 'A3', width: 297, height: 420, category: '办公用纸' },
  { id: 'A4', label: 'A4', width: 210, height: 297, category: '办公用纸' },
  { id: 'A5', label: 'A5', width: 148, height: 210, category: '办公用纸' },
  { id: 'A6', label: 'A6', width: 105, height: 148, category: '办公用纸' },
  { id: 'B5', label: 'B5（ISO）', width: 176, height: 250, category: '办公用纸' },
  { id: '5R', label: '5 寸（3R）', width: 89, height: 127, category: '照片相纸' },
  { id: '6R', label: '6 寸（4R）', width: 102, height: 152, category: '照片相纸' },
  { id: '7R', label: '7 寸（5R）', width: 127, height: 178, category: '照片相纸' },
  { id: '8R', label: '8 寸（6R）', width: 152, height: 203, category: '照片相纸' },
  { id: 'custom', label: '自定义尺寸', width: 210, height: 297, category: '自定义' }
]);

export function resolvePaperSize(state) {
  const preset = PAPER_PRESETS.find(p => p.id === state.paper) || PAPER_PRESETS[1];
  let width = preset.id === 'custom' ? finiteInRange(state.customPaperWidth, 210, 50, 500) : preset.width;
  let height = preset.id === 'custom' ? finiteInRange(state.customPaperHeight, 297, 50, 700) : preset.height;
  if (state.orientation === 'landscape') [width, height] = [height, width];
  return { width, height, id: preset.id, label: preset.label };
}

export function finiteInRange(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && value !== '' ? Math.min(max, Math.max(min, number)) : fallback;
}

export function paperCaption(state) {
  const paper = resolvePaperSize(state);
  return `${paper.label} · ${state.orientation === 'landscape' ? '横向' : '纵向'} · ${paper.width} × ${paper.height} mm`;
}
