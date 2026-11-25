/**
 * Canvas-first presentation shell. Does not own document data or edit operations.
 * It controls only overlays/drawers and short-lived focus states.
 */
export function createCanvasShell({
  openImagePicker, openExportSheet, selectModeToggle, getSelectMode,
  clearSelection, onAssetsOpened, getSelectionCount
}) {
  const byId = id => document.getElementById(id);
  const backdrop = byId('drawerBackdrop');
  const selectionBackdrop = byId('selectionSheetBackdrop');
  const drawers = { assets: byId('assetsDrawer'), settings: byId('settingsDrawer') };
  Object.values(drawers).forEach(drawer => { if (drawer) drawer.inert = true; });
  const selectionMini = byId('selectionMini');
  const miniCount = byId('selectionMiniCount');
  let activeDrawer = null;
  let lastDrawerTrigger = null;
  const bindClick = (id, handler) => byId(id)?.addEventListener('click', handler);

  function closeDrawer() {
    if (!activeDrawer) return;
    const closing = activeDrawer;
    activeDrawer = null;
    Object.entries(drawers).forEach(([name, drawer]) => {
      drawer?.setAttribute('aria-hidden', 'true');
      if (drawer) drawer.inert = true;
      drawer?.classList.remove('drawer-visible');
    });
    document.body.classList.remove('drawer-open', 'drawer-assets-open', 'drawer-settings-open');
    backdrop?.classList.add('hidden');
    backdrop?.setAttribute('aria-hidden','true');
    if (lastDrawerTrigger && document.contains(lastDrawerTrigger)) lastDrawerTrigger.focus({preventScroll:true});
    if (closing === 'settings') window.dispatchEvent(new Event('sticker:settings-closed'));
  }

  function openDrawer(name, trigger = document.activeElement) {
    if (!drawers[name]) return;
    if (activeDrawer) closeDrawer();
    closeSelectionSheet();
    activeDrawer = name;
    lastDrawerTrigger = trigger;
    Object.entries(drawers).forEach(([type,drawer]) => {
      drawer?.classList.toggle('drawer-visible', type === name);
      if (drawer) drawer.inert = type !== name;
      drawer?.setAttribute('aria-hidden', String(type !== name));
    });
    document.body.classList.add('drawer-open', `drawer-${name}-open`);
    backdrop?.classList.remove('hidden');
    backdrop?.setAttribute('aria-hidden','false');
    const target = drawers[name];
    requestAnimationFrame(() => {
      target?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
      if (name === 'assets') onAssetsOpened?.();
    });
  }

  function openSelectionSheet() {
    if (!getSelectionCount()) return;
    closeDrawer();
    selectionBackdrop?.classList.remove('hidden');
    selectionBackdrop?.setAttribute('aria-hidden','false');
    document.body.classList.add('selection-sheet-open');
    requestAnimationFrame(() => byId('closeSelectionSheetBtn')?.focus({preventScroll:true}));
  }

  function closeSelectionSheet() {
    selectionBackdrop?.classList.add('hidden');
    selectionBackdrop?.setAttribute('aria-hidden','true');
    document.body.classList.remove('selection-sheet-open');
  }

  function syncSelection(count, activeMultiSelect = getSelectMode()) {
    if (miniCount) miniCount.textContent = String(count);
    selectionMini?.classList.toggle('hidden', count === 0);
    if (count === 0) closeSelectionSheet();
    const select = byId('canvasSelectBtn');
    if (select) {
      select.setAttribute('aria-pressed', String(activeMultiSelect));
      select.classList.toggle('active', activeMultiSelect);
      select.querySelector('span:last-child').textContent = activeMultiSelect ? '完成' : '多选';
    }
  }

  bindClick('canvasAddBtn', () => openImagePicker?.());
  bindClick('canvasAssetsBtn', e => openDrawer('assets',e.currentTarget));
  bindClick('canvasSettingsBtn', e => openDrawer('settings',e.currentTarget));
  bindClick('canvasExportBtn', () => { closeDrawer(); openExportSheet?.(); });
  bindClick('headerExportBtn', () => { closeDrawer(); openExportSheet?.(); });
  bindClick('canvasSelectBtn', () => { selectModeToggle?.(); syncSelection(getSelectionCount(), getSelectMode()); });
  bindClick('closeAssetsDrawerBtn', closeDrawer);
  bindClick('closeSettingsDrawerBtn', closeDrawer);
  bindClick('openSelectionSheetBtn', openSelectionSheet);
  bindClick('closeSelectionSheetBtn', closeSelectionSheet);
  bindClick('selectionMiniClearBtn', clearSelection);
  backdrop?.addEventListener('click', e => { if (e.target === backdrop) closeDrawer(); });
  selectionBackdrop?.addEventListener('click', e => { if (e.target === selectionBackdrop) closeSelectionSheet(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (selectionBackdrop && !selectionBackdrop.classList.contains('hidden')) { e.stopPropagation(); closeSelectionSheet(); }
    else if (activeDrawer) { e.stopPropagation(); closeDrawer(); }
  });

  // Empty state is re-created on every render; delegate to the canvas.
  byId('previewArea')?.addEventListener('click', e => {
    if (e.target.closest('[data-action="add-photos"]')) openImagePicker?.();
  });

  return { openDrawer, closeDrawer, openSelectionSheet, closeSelectionSheet, syncSelection };
}
