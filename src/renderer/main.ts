import { createAppState } from './lib/state';

const state = createAppState();
const api = window.api;

// Elements
const btnOpen = document.getElementById('btn-open') as HTMLButtonElement;
const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement;
const btnDelete = document.getElementById('btn-delete') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const gifPreview = document.getElementById('gif-preview') as HTMLImageElement;
const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const frameCardsContainer = document.getElementById('frame-cards') as HTMLDivElement;
const btnCropToggle = document.getElementById('btn-crop-toggle') as HTMLButtonElement;
const btnCropApply = document.getElementById('btn-crop-apply') as HTMLButtonElement;
const btnMosaicToggle = document.getElementById('btn-mosaic-toggle') as HTMLButtonElement;
const mosaicControls = document.getElementById('mosaic-controls') as HTMLDivElement;
const mosaicRangeLabel = document.getElementById('mosaic-range-label') as HTMLSpanElement;
const btnMosaicSelected = document.getElementById('btn-mosaic-selected') as HTMLButtonElement;
const btnMosaicApply = document.getElementById('btn-mosaic-apply') as HTMLButtonElement;
const btnReduce2 = document.getElementById('btn-reduce-2') as HTMLButtonElement;
const btnReduce4 = document.getElementById('btn-reduce-4') as HTMLButtonElement;
const btnReduce8 = document.getElementById('btn-reduce-8') as HTMLButtonElement;
const progressOverlay = document.getElementById('progress-overlay') as HTMLDivElement;
const progressFill = document.getElementById('progress-fill') as HTMLDivElement;
const progressText = document.getElementById('progress-text') as HTMLSpanElement;

let drawMode: 'none' | 'crop' | 'mosaic' = 'none';
let drawStart: { x: number; y: number } | null = null;
let drawRect: { x: number; y: number; width: number; height: number } | null = null;
let cropRect: { x: number; y: number; width: number; height: number } | null = null;
let mosaicRect: { x: number; y: number; width: number; height: number } | null = null;
let mosaicUseSelection = false;
let lastClickedIndex = -1;
let isPlaying = false;
let previewGifPath: string | null = null;
let busy = false; // Lock to prevent concurrent destructive operations

function showProgress(text: string): void {
  progressText.textContent = text;
  progressFill.style.width = '0%';
  progressOverlay.style.display = 'flex';
}

function hideProgress(): void {
  progressOverlay.style.display = 'none';
}

function updateStatus(text: string): void {
  statusText.textContent = text;
}

// --- Preview: static frame vs animated GIF ---

function showStaticFrame(index: number): void {
  isPlaying = false;
  btnPlay.textContent = 'Play';
  api.getFrameDataUrl(index).then(dataUrl => {
    gifPreview.src = dataUrl;
  });
}

function showAnimatedPreview(): void {
  if (!previewGifPath) return;
  isPlaying = true;
  btnPlay.textContent = 'Stop';
  gifPreview.src = `file://${previewGifPath}?t=${Date.now()}`;
}

function stopAnimation(): void {
  isPlaying = false;
  btnPlay.textContent = 'Play';
  // Show the first selected frame, or frame 0
  const idx = state.selectedFrames.size > 0
    ? Math.min(...state.selectedFrames)
    : 0;
  showStaticFrame(idx);
}

// --- Frame cards ---

async function loadFrameCards(): Promise<void> {
  const thumbnails = await api.getThumbnails(80);
  frameCardsContainer.innerHTML = '';
  state.selectedFrames.clear();

  for (let i = 0; i < thumbnails.length; i++) {
    const card = document.createElement('div');
    card.className = 'frame-card';
    card.dataset.index = String(i);

    const img = document.createElement('img');
    img.src = thumbnails[i];
    card.appendChild(img);

    const label = document.createElement('div');
    label.className = 'frame-number';
    label.textContent = String(i + 1);
    card.appendChild(label);

    card.addEventListener('click', (e) => onFrameCardClick(i, e));
    frameCardsContainer.appendChild(card);
  }

  updateDeleteButton();
  // Show first frame as static
  if (thumbnails.length > 0) {
    showStaticFrame(0);
  }
}

function onFrameCardClick(index: number, e: MouseEvent): void {
  if (e.shiftKey && lastClickedIndex >= 0) {
    const start = Math.min(lastClickedIndex, index);
    const end = Math.max(lastClickedIndex, index);
    if (!e.ctrlKey && !e.metaKey) {
      state.selectedFrames.clear();
    }
    for (let i = start; i <= end; i++) {
      state.selectedFrames.add(i);
    }
  } else if (e.ctrlKey || e.metaKey) {
    if (state.selectedFrames.has(index)) {
      state.selectedFrames.delete(index);
    } else {
      state.selectedFrames.add(index);
    }
  } else {
    state.selectedFrames.clear();
    state.selectedFrames.add(index);
  }

  lastClickedIndex = index;
  updateCardSelectionUI();
  updateDeleteButton();
  updateMosaicRangeLabel();

  // Show selected frame as static preview
  showStaticFrame(index);
}

function updateCardSelectionUI(): void {
  const cards = frameCardsContainer.querySelectorAll('.frame-card');
  cards.forEach((card, i) => {
    card.classList.toggle('selected', state.selectedFrames.has(i));
  });
}

function updateDeleteButton(): void {
  btnDelete.disabled = state.selectedFrames.size === 0;
}

function updateMosaicRangeLabel(): void {
  if (mosaicUseSelection && state.selectedFrames.size > 0) {
    const sorted = [...state.selectedFrames].sort((a, b) => a - b);
    mosaicRangeLabel.textContent = `Frames: ${sorted[0] + 1}-${sorted[sorted.length - 1] + 1}`;
  } else {
    mosaicRangeLabel.textContent = 'Frames: all';
  }
}

// --- Refresh after destructive operation ---

async function refreshAfterEdit(): Promise<void> {
  showProgress('Encoding preview...');
  previewGifPath = await api.encodePreview();

  showProgress('Loading thumbnails...');
  await loadFrameCards();
  hideProgress();
  await updateUndoRedoButtons();
}

// --- Canvas ---

function updateCanvas(): void {
  const img = gifPreview;
  const rect = img.getBoundingClientRect();
  const container = img.parentElement!.getBoundingClientRect();
  overlayCanvas.width = rect.width;
  overlayCanvas.height = rect.height;
  overlayCanvas.style.left = `${rect.left - container.left}px`;
  overlayCanvas.style.top = `${rect.top - container.top}px`;

  const ctx = overlayCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!state.inputMetadata) return;
  const scaleX = overlayCanvas.width / state.inputMetadata.width;
  const scaleY = overlayCanvas.height / state.inputMetadata.height;

  // Draw crop rect preview
  if (cropRect) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.clearRect(
      cropRect.x * scaleX, cropRect.y * scaleY,
      cropRect.width * scaleX, cropRect.height * scaleY,
    );
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      cropRect.x * scaleX, cropRect.y * scaleY,
      cropRect.width * scaleX, cropRect.height * scaleY,
    );
  }

  // Draw mosaic rect preview
  if (mosaicRect) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      mosaicRect.x * scaleX, mosaicRect.y * scaleY,
      mosaicRect.width * scaleX, mosaicRect.height * scaleY,
    );
    ctx.setLineDash([]);
  }

  // Draw active drawing rect
  if (drawRect) {
    const color = drawMode === 'crop' ? '#e94560' : '#00ff88';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(drawMode === 'mosaic' ? [5, 5] : []);
    ctx.strokeRect(
      drawRect.x * scaleX, drawRect.y * scaleY,
      drawRect.width * scaleX, drawRect.height * scaleY,
    );
    ctx.setLineDash([]);
  }
}

function canvasToVideo(clientX: number, clientY: number): { x: number; y: number } {
  const rect = overlayCanvas.getBoundingClientRect();
  if (!state.inputMetadata) return { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(state.inputMetadata.width, Math.round(((clientX - rect.left) / overlayCanvas.width) * state.inputMetadata.width))),
    y: Math.max(0, Math.min(state.inputMetadata.height, Math.round(((clientY - rect.top) / overlayCanvas.height) * state.inputMetadata.height))),
  };
}

// mousedown on canvas
overlayCanvas.addEventListener('mousedown', (e) => {
  if (drawMode === 'none') return;
  drawStart = canvasToVideo(e.clientX, e.clientY);
  drawRect = { x: drawStart.x, y: drawStart.y, width: 0, height: 0 };
});

// mousemove on document (so dragging outside canvas still works)
document.addEventListener('mousemove', (e) => {
  if (!drawStart || !drawRect) return;
  const current = canvasToVideo(e.clientX, e.clientY);
  drawRect = {
    x: Math.min(drawStart.x, current.x),
    y: Math.min(drawStart.y, current.y),
    width: Math.abs(current.x - drawStart.x),
    height: Math.abs(current.y - drawStart.y),
  };
  updateCanvas();
});

// mouseup on document (fixes the bug where releasing outside canvas leaves drag stuck)
document.addEventListener('mouseup', () => {
  if (!drawStart) return;

  if (drawRect && drawRect.width >= 2 && drawRect.height >= 2) {
    if (drawMode === 'crop') {
      cropRect = { ...drawRect };
      btnCropApply.disabled = false;
    } else if (drawMode === 'mosaic') {
      mosaicRect = { ...drawRect };
      btnMosaicApply.disabled = false;
    }
  }

  drawStart = null;
  drawRect = null;
  updateCanvas();
});

// --- Buttons ---

function enableEditButtons(enabled: boolean): void {
  btnExport.disabled = !enabled;
  btnCropToggle.disabled = !enabled;
  btnMosaicToggle.disabled = !enabled;
  btnReduce2.disabled = !enabled;
  btnReduce4.disabled = !enabled;
  btnReduce8.disabled = !enabled;
  btnPlay.disabled = !enabled;
}

async function updateUndoRedoButtons(): Promise<void> {
  const [canUndo, canRedo] = await Promise.all([api.hasUndo(), api.hasRedo()]);
  btnUndo.disabled = !canUndo;
  btnRedo.disabled = !canRedo;
  state.canUndo = canUndo;
}

// Open
btnOpen.addEventListener('click', async () => {
  showProgress('Opening GIF...');
  const result = await api.openFile();
  hideProgress();
  if (!result) return;

  state.filePath = result.filePath;
  state.inputMetadata = {
    filePath: result.filePath,
    duration: result.duration,
    width: result.width,
    height: result.height,
    frameCount: result.frameCount,
    fps: result.fps,
  };
  state.crop = null;
  state.framesExtracted = true;
  state.frameMetadata = result.frameMetadata;
  cropRect = null;
  mosaicRect = null;
  previewGifPath = result.previewPath;

  enableEditButtons(true);
  updateStatus(`${result.width}×${result.height} | ${result.frameCount} frames | ${result.fps.toFixed(1)}fps`);

  showProgress('Loading thumbnails...');
  await loadFrameCards();
  hideProgress();
  await updateUndoRedoButtons();
});

gifPreview.addEventListener('load', updateCanvas);

// Play / Stop
btnPlay.addEventListener('click', () => {
  if (isPlaying) {
    stopAnimation();
  } else {
    showAnimatedPreview();
  }
});

// Delete selected frames
btnDelete.addEventListener('click', async () => {
  if (busy) return;
  if (state.selectedFrames.size === 0 || !state.frameMetadata) return;
  if (state.selectedFrames.size >= state.frameMetadata.frameCount) {
    updateStatus('Cannot delete all frames');
    return;
  }

  busy = true;
  try {
    showProgress('Deleting frames...');
    const indices = [...state.selectedFrames].sort((a, b) => a - b);
    const newMeta = await api.deleteFrames(indices);
    state.frameMetadata = newMeta;

    await refreshAfterEdit();
    updateStatus(`${newMeta.frameCount} frames remaining`);
  } finally {
    busy = false;
  }
});

// Crop
btnCropToggle.addEventListener('click', () => {
  if (drawMode === 'crop') {
    drawMode = 'none';
    overlayCanvas.classList.remove('drawing');
    btnCropToggle.classList.remove('active');
  } else {
    drawMode = 'crop';
    overlayCanvas.classList.add('drawing');
    btnCropToggle.classList.add('active');
    btnMosaicToggle.classList.remove('active');
    mosaicControls.style.display = 'none';
  }
});

btnCropApply.addEventListener('click', async () => {
  if (busy || !cropRect) return;
  busy = true;
  try {
    showProgress('Applying crop...');
    const result = await api.applyCrop(cropRect);

    if (state.inputMetadata) {
      state.inputMetadata.width = result.width;
      state.inputMetadata.height = result.height;
    }

    cropRect = null;
    btnCropApply.disabled = true;
    drawMode = 'none';
    overlayCanvas.classList.remove('drawing');
    btnCropToggle.classList.remove('active');

    await refreshAfterEdit();
    updateStatus(`Cropped to ${result.width}×${result.height}`);
  } finally {
    busy = false;
  }
});

// Mosaic
btnMosaicToggle.addEventListener('click', () => {
  if (drawMode === 'mosaic') {
    drawMode = 'none';
    overlayCanvas.classList.remove('drawing');
    btnMosaicToggle.classList.remove('active');
    mosaicControls.style.display = 'none';
  } else {
    drawMode = 'mosaic';
    overlayCanvas.classList.add('drawing');
    btnMosaicToggle.classList.add('active');
    btnCropToggle.classList.remove('active');
    mosaicControls.style.display = 'flex';
    updateMosaicRangeLabel();
  }
});

btnMosaicSelected.addEventListener('click', () => {
  mosaicUseSelection = !mosaicUseSelection;
  btnMosaicSelected.classList.toggle('active', mosaicUseSelection);
  updateMosaicRangeLabel();
});

btnMosaicApply.addEventListener('click', async () => {
  if (busy || !mosaicRect || !state.frameMetadata) return;
  busy = true;
  try {
    let startFrame = 0;
    let endFrame = state.frameMetadata.frameCount;

    if (mosaicUseSelection && state.selectedFrames.size > 0) {
      const sorted = [...state.selectedFrames].sort((a, b) => a - b);
      startFrame = sorted[0];
      endFrame = sorted[sorted.length - 1] + 1;
    }

    showProgress('Applying mosaic...');
    await api.applyMosaic(startFrame, endFrame, mosaicRect, 10);

    mosaicRect = null;
    btnMosaicApply.disabled = true;

    await refreshAfterEdit();
    updateCanvas();
    updateStatus('Mosaic applied');
  } finally {
    busy = false;
  }
});

// Frame reduction
async function doReduce(rate: 2 | 4 | 8): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    showProgress(`Reducing frames (1/${rate})...`);
    const result = await api.reduceFrames(rate);
    state.frameMetadata!.frameCount = result.frameCount;
    state.frameMetadata!.frameInterval = result.frameInterval;

    await refreshAfterEdit();
    updateStatus(`Frames reduced to ${result.frameCount}`);
  } finally {
    busy = false;
  }
}

btnReduce2.addEventListener('click', () => doReduce(2));
btnReduce4.addEventListener('click', () => doReduce(4));
btnReduce8.addEventListener('click', () => doReduce(8));

// Undo
btnUndo.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  try {
    showProgress('Undoing...');
    const result = await api.undo();
    if (result) {
      state.frameMetadata!.frameCount = result.prevFrameCount;
      state.frameMetadata!.frameInterval = result.prevFrameInterval;
    }

    await refreshAfterEdit();
    updateStatus('Undo complete');
  } finally {
    busy = false;
  }
});

// Redo
btnRedo.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  try {
    showProgress('Redoing...');
    const result = await api.redo();
    if (result) {
      state.frameMetadata!.frameCount = result.prevFrameCount;
      state.frameMetadata!.frameInterval = result.prevFrameInterval;
    }

    await refreshAfterEdit();
    updateStatus('Redo complete');
  } finally {
    busy = false;
  }
});

// Export
btnExport.addEventListener('click', async () => {
  if (busy || !state.frameMetadata) return;
  busy = true;
  try {
    showProgress('Exporting GIF...');
    const outputPath = await api.exportGif();
    hideProgress();
    if (outputPath) {
      updateStatus(`Exported: ${outputPath}`);
    }
  } finally {
    busy = false;
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (busy) return;

  const mod = e.metaKey || e.ctrlKey;

  // Cmd+O → Open
  if (mod && (e.key === 'o' || e.key === 'O')) {
    e.preventDefault();
    btnOpen.click();
    return;
  }

  // Cmd+E → Export
  if (mod && (e.key === 'e' || e.key === 'E')) {
    e.preventDefault();
    if (!btnExport.disabled) btnExport.click();
    return;
  }

  // Cmd+Shift+Z / Cmd+Y → Redo (check before Cmd+Z)
  if (mod && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
    e.preventDefault();
    if (!btnRedo.disabled) btnRedo.click();
    return;
  }

  // Cmd+Z → Undo
  if (mod && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    if (!btnUndo.disabled) btnUndo.click();
    return;
  }

  // Arrow keys → move frame selection
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    if (!state.frameMetadata || state.frameMetadata.frameCount === 0) return;

    const maxIndex = state.frameMetadata.frameCount - 1;
    const current = state.selectedFrames.size > 0
      ? (e.key === 'ArrowLeft' ? Math.min(...state.selectedFrames) : Math.max(...state.selectedFrames))
      : 0;

    const next = e.key === 'ArrowLeft'
      ? Math.max(0, current - 1)
      : Math.min(maxIndex, current + 1);

    state.selectedFrames.clear();
    state.selectedFrames.add(next);
    lastClickedIndex = next;
    updateCardSelectionUI();
    updateDeleteButton();
    updateMosaicRangeLabel();
    showStaticFrame(next);

    const card = frameCardsContainer.children[next] as HTMLElement;
    if (card) {
      card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    return;
  }

  // Delete / Fn+Backspace → delete selected frames
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!btnDelete.disabled && state.selectedFrames.size > 0) {
      e.preventDefault();
      btnDelete.click();
    }
  }
});

// Resize handler
window.addEventListener('resize', updateCanvas);
