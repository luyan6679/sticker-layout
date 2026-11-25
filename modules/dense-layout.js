/**
 * 超密集排版 · 见缝插针（MaxRects 多策略二维装箱）。
 * 无 DOM、无浏览器依赖。计算使用毫米，不修改照片实际尺寸或原始状态。
 *
 * 对每张纸从所有剩余素材中挑选能填入任一空闲矩形的照片，
 * 再将其占用空间从可用矩形集合中剔除。不同启发式策略竞争，
 * 优先选择页数更少的方案。二维装箱是 NP-hard，无法保证绝对最优。
 */
const EPS = 1e-7;

function intersects(a, b) {
  return a.x < b.x + b.width - EPS && a.x + a.width > b.x + EPS &&
         a.y < b.y + b.height - EPS && a.y + a.height > b.y + EPS;
}
function contains(a, b) {
  return b.x >= a.x - EPS && b.y >= a.y - EPS &&
         b.x + b.width <= a.x + a.width + EPS &&
         b.y + b.height <= a.y + a.height + EPS;
}
function splitFreeRects(free, occupied) {
  const next = [];
  for (const rect of free) {
    if (!intersects(rect, occupied)) { next.push(rect); continue; }
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    const occRight = occupied.x + occupied.width;
    const occBottom = occupied.y + occupied.height;
    if (occupied.x > rect.x + EPS) next.push({ x:rect.x, y:rect.y, width:occupied.x-rect.x, height:rect.height });
    if (occRight < right - EPS) next.push({ x:occRight, y:rect.y, width:right-occRight, height:rect.height });
    if (occupied.y > rect.y + EPS) next.push({ x:rect.x, y:rect.y, width:rect.width, height:occupied.y-rect.y });
    if (occBottom < bottom - EPS) next.push({ x:rect.x, y:occBottom, width:rect.width, height:bottom-occBottom });
  }
  // Remove duplicate/contained spaces. Their intersections are allowed: they
  // represent alternative openings, not already occupied rectangles.
  const result = [];
  for (let i=0; i<next.length; i++) {
    const candidate = next[i];
    if (candidate.width <= EPS || candidate.height <= EPS) continue;
    let redundant = false;
    for (let j=0; j<next.length; j++) {
      if (i === j) continue;
      if (contains(next[j], candidate) && (j < i || !contains(candidate,next[j]))) {
        redundant = true; break;
      }
    }
    if (!redundant) result.push(candidate);
  }
  return result;
}

function score(strategy, item, rect, width, height, rotated, index, gap) {
  const aw = width + gap, ah = height + gap;
  const dw = Math.max(0, rect.width - aw), dh = Math.max(0, rect.height - ah);
  const area = width * height;
  const waste = rect.width * rect.height - aw * ah;
  const last = [rect.y, rect.x, rotated ? 1 : 0, index];
  if (strategy === 'largest') return [-area, waste, Math.min(dw,dh), ...last];
  if (strategy === 'short') return [Math.min(dw,dh), Math.max(dw,dh), -area, ...last];
  if (strategy === 'bottom') return [rect.y, rect.x, -area, waste, rotated ? 1:0, index];
  return [waste, Math.min(dw,dh), -area, ...last]; // best area fit
}
function isBetter(scores, current) {
  if (!current) return true;
  const prev = current.scores;
  for (let i=0; i<scores.length; i++) {
    if (scores[i] < prev[i] - EPS) return true;
    if (scores[i] > prev[i] + EPS) return false;
  }
  return false;
}

function packOnePage(items, usableW, usableH, margin, gap, strategy, rotate) {
  let remaining = items.slice();
  let free = [{x:margin,y:margin,width:usableW+gap,height:usableH+gap}];
  const page = [];
  while (remaining.length && free.length) {
    let best = null;
    for (let i=0; i<remaining.length; i++) {
      const item = remaining[i];
      const shapes = [{width:Number(item.width),height:Number(item.height),rotated:false}];
      if (rotate && Math.abs(Number(item.width) - Number(item.height)) > EPS) {
        shapes.push({width:Number(item.height),height:Number(item.width),rotated:true});
      }
      for (const shape of shapes) {
        const w = shape.width + gap, h = shape.height + gap;
        for (const rect of free) {
          if (w > rect.width + EPS || h > rect.height + EPS) continue;
          const scores = score(strategy,item,rect,shape.width,shape.height,shape.rotated,i,gap);
          if (isBetter(scores,best)) best = {index:i, rect, ...shape, scores};
        }
      }
    }
    if (!best) break; // Every remaining item was tested against every hole.
    const item = remaining.splice(best.index,1)[0];
    page.push({ ...item, x:best.rect.x, y:best.rect.y,
      width:best.width, height:best.height, rotated:best.rotated });
    free = splitFreeRects(free, {x:best.rect.x,y:best.rect.y,
      width:best.width+gap,height:best.height+gap});
  }
  return {page,remaining};
}

function tryStrategy(items, usableW, usableH, margin, gap, rotate, strategy) {
  const pages = [];
  let remaining = items;
  while (remaining.length) {
    const result = packOnePage(remaining,usableW,usableH,margin,gap,strategy,rotate);
    if (!result.page.length) return null; // Guard: do not loop forever.
    pages.push(result.page);
    remaining = result.remaining;
  }
  return pages;
}

function quality(pages, usableArea) {
  // The number of pages is the primary measure. For ties favor fuller early
  // pages to avoid an odd-sized last sheet and to make export more practical.
  const total = pages.length;
  const early = pages.reduce((sum,page,i) => sum +
    page.reduce((a,p) => a+p.width*p.height,0) * (total-i), 0);
  return {total,early:early/Math.max(1,usableArea)};
}

/** Returns a list of pages of placements; over-size filtering is caller's job. */
export function packDensePages(items, paper, margin, gap, allowRotation = true) {
  if (!items.length) return [];
  const width = paper.width - 2*margin;
  const height = paper.height - 2*margin;
  if (width <= 0 || height <= 0) return [];
  // Bound worst-case latency for very large batches without a back-end.
  const strategies = items.length > 750 ? ['largest','area'] :
    ['largest','area','short','bottom'];
  let best = null;
  let bestQuality = null;
  for (const strategy of strategies) {
    const pages = tryStrategy(items,width,height,margin,gap,allowRotation,strategy);
    if (!pages) continue;
    const q = quality(pages,width*height);
    if (!bestQuality || q.total < bestQuality.total ||
        (q.total === bestQuality.total && q.early > bestQuality.early + EPS)) {
      best = pages;
      bestQuality = q;
    }
    // Single sheet is already optimal for page count.
    if (q.total === 1) break;
  }
  return best || [];
}
