import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Palette,
  Smile,
  PenTool,
  Type,
  RotateCcw,
  Trash2,
  Camera,
  X,
  Move,
  Check,
} from 'lucide-react';
import { DoodlePoint, DoodleStroke, FrameDecorations, RoomState, StickerItem } from '../types';
import {
  FILTER_PRESETS,
  FRAME_COLORS,
  KOREAN_THEME_PRESETS,
  PATTERN_PRESETS,
  STICKER_PRESETS,
  TEMPLATE_PRESETS,
} from '../utils/presets';

interface DecorationStudioViewProps {
  room: RoomState;
  userId: string;
  onUpdateFrameDecorations: (decorations: Partial<FrameDecorations>) => void;
  onAddSticker: (sticker: Omit<StickerItem, 'id' | 'createdBy'>) => void;
  onUpdateSticker: (sticker: Partial<StickerItem> & { id: string }) => void;
  onRemoveSticker: (stickerId: string) => void;
  onAddDoodleStroke: (stroke: Omit<DoodleStroke, 'id' | 'createdBy'>) => void;
  onUndoDoodle: () => void;
  onClearDoodles: () => void;
  onBackToCamera: () => void;
  onFinishAndPrint: () => void;
}

export const DecorationStudioView: React.FC<DecorationStudioViewProps> = ({
  room,
  onUpdateFrameDecorations,
  onAddSticker,
  onUpdateSticker,
  onRemoveSticker,
  onAddDoodleStroke,
  onUndoDoodle,
  onClearDoodles,
  onBackToCamera,
  onFinishAndPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'filter' | 'frame' | 'stickers' | 'doodle' | 'text'>(
    'filter'
  );
  const [penColor, setPenColor] = useState('#F43F5E');
  const [penWidth, setPenWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);

  const doodleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stripContainerRef = useRef<HTMLDivElement | null>(null);
  const currentStrokePoints = useRef<DoodlePoint[]>([]);

  const currentTemplate =
    TEMPLATE_PRESETS.find((t) => t.id === room.templateId) || TEMPLATE_PRESETS[0];

  const decorations = room.decorations;
  const currentFilter =
    FILTER_PRESETS.find((f) => f.id === decorations.filter) || FILTER_PRESETS[0];

  // Re-draw doodles on canvas when room.decorations.doodles change
  const renderDoodles = useCallback(() => {
    const canvas = doodleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    decorations.doodles.forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const first = stroke.points[0];
      ctx.moveTo((first.x / 100) * canvas.width, (first.y / 100) * canvas.height);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo((pt.x / 100) * canvas.width, (pt.y / 100) * canvas.height);
      }
      ctx.stroke();
    });
  }, [decorations.doodles]);

  // Sync canvas size to container
  useEffect(() => {
    const container = stripContainerRef.current;
    const canvas = doodleCanvasRef.current;
    if (container && canvas) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      renderDoodles();
    }
  }, [renderDoodles, room.templateId]);

  // Redraw when doodles update
  useEffect(() => {
    renderDoodles();
  }, [decorations.doodles, renderDoodles]);

  // Doodle mouse/touch handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'doodle') return;
    const canvas = doodleCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    currentStrokePoints.current = [{ x, y }];

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTab !== 'doodle') return;
    const canvas = doodleCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    currentStrokePoints.current.push({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || activeTab !== 'doodle') return;
    setIsDrawing(false);

    if (currentStrokePoints.current.length > 1) {
      onAddDoodleStroke({
        color: penColor,
        strokeWidth: penWidth,
        points: [...currentStrokePoints.current],
      });
    }
    currentStrokePoints.current = [];
  };

  // Sticker dragging
  const handleStickerDrag = (
    e: React.PointerEvent,
    sticker: StickerItem
  ) => {
    e.stopPropagation();
    setActiveStickerId(sticker.id);

    const container = stripContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialStickerX = sticker.x;
    const initialStickerY = sticker.y;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;

      const newX = Math.max(5, Math.min(95, initialStickerX + deltaX));
      const newY = Math.max(5, Math.min(95, initialStickerY + deltaY));

      onUpdateSticker({ id: sticker.id, x: newX, y: newY });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleRotateSticker = (stickerId: string, currentRot: number) => {
    onUpdateSticker({ id: stickerId, rotation: (currentRot + 15) % 360 });
  };

  const handleScaleSticker = (stickerId: string, currentScale: number, delta: number) => {
    const newScale = Math.max(0.6, Math.min(2.5, currentScale + delta));
    onUpdateSticker({ id: stickerId, scale: newScale });
  };

  const isDarkFrame =
    decorations.frameColor === '#18181B' || decorations.frameColor === '#292524';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Studio Header Bar */}
      <div className="bg-white rounded-2xl border border-[#E7E2D9] p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-[#1C1917] font-['Outfit',sans-serif]">
              Studio Dekorasi Kolaboratif
            </h2>
            <p className="text-xs text-[#78716C]">
              Perubahan filter, frame, stiker, dan coretan tersinkron realtime ke layar pasangan/teman.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToCamera}
            className="px-3.5 py-2 text-xs font-semibold text-[#78716C] hover:text-[#1C1917] hover:bg-[#FAF7F2] rounded-xl border border-[#E7E2D9] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Kembali Foto</span>
          </button>
          <button
            type="button"
            onClick={onFinishAndPrint}
            className="px-4 py-2 text-xs md:text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 active:scale-98"
          >
            <Sparkles className="w-4 h-4" />
            <span>Selesai & Cetak Strip</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Real-Time Photostrip Preview (5 cols) */}
        <div className="lg:col-span-5 flex justify-center">
          <div
            ref={stripContainerRef}
            style={{
              backgroundColor: decorations.frameColor,
              color: isDarkFrame ? '#FFFFFF' : '#1C1917',
              maxWidth: currentTemplate.layoutType === 'grid' || currentTemplate.layoutType === 'postcard' ? '420px' : '320px',
            }}
            className={`w-full relative rounded-2xl shadow-xl border border-black/10 p-5 md:p-6 transition-all select-none overflow-hidden ${
              decorations.borderPattern === 'checkered'
                ? 'bg-[radial-gradient(#0000000d_1px,transparent_1px)] [background-size:16px_16px]'
                : decorations.borderPattern === 'dots'
                ? 'bg-[radial-gradient(#00000015_2px,transparent_2px)] [background-size:20px_20px]'
                : ''
            }`}
          >
            {/* Slot Photos Container */}
            <div
              className={`gap-3 ${
                currentTemplate.layoutType === 'grid'
                  ? 'grid grid-cols-2'
                  : currentTemplate.layoutType === 'postcard'
                  ? 'grid grid-cols-2'
                  : 'flex flex-col'
              }`}
            >
              {Array.from({ length: currentTemplate.slotCount }).map((_, idx) => {
                const slot = room.slots[idx];
                const hasPhotoA = Boolean(slot?.photoDataA);
                const hasPhotoB = Boolean(slot?.photoDataB);

                return (
                  <div
                    key={idx}
                    style={{
                      filter: currentFilter.cssFilter,
                      aspectRatio: `${currentTemplate.slotAspect}`,
                    }}
                    className="relative w-full rounded-lg overflow-hidden bg-[#E2E8F0] shadow-xs flex items-center justify-center border border-black/5"
                  >
                    {room.captureMode === 'split' && hasPhotoA && hasPhotoB ? (
                      <div className="w-full h-full flex divide-x divide-white/40">
                        <img
                          src={slot?.photoDataA}
                          alt={`Slot ${idx + 1} A`}
                          className="w-1/2 h-full object-cover"
                        />
                        <img
                          src={slot?.photoDataB}
                          alt={`Slot ${idx + 1} B`}
                          className="w-1/2 h-full object-cover"
                        />
                      </div>
                    ) : hasPhotoA || hasPhotoB ? (
                      <img
                        src={slot?.photoDataA || slot?.photoDataB}
                        alt={`Slot ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-mono text-[#94A3B8]">
                        Shot {idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Branding */}
            <div className="mt-5 text-center flex flex-col items-center">
              <span className="font-['Outfit',sans-serif] font-bold text-sm tracking-widest uppercase">
                {currentTemplate.koreanName || '인생네컷'}
              </span>
              {decorations.captionText && (
                <span className="text-xs font-medium tracking-tight mt-0.5 opacity-90">
                  {decorations.captionText}
                </span>
              )}
              {decorations.dateStamp && (
                <span className="text-[10px] font-mono tracking-widest mt-1 opacity-70">
                  {decorations.dateStamp}
                </span>
              )}
            </div>

            {/* Doodles Canvas Overlay */}
            <canvas
              ref={doodleCanvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`absolute inset-0 z-20 ${
                activeTab === 'doodle' ? 'cursor-crosshair' : 'pointer-events-none'
              }`}
            />

            {/* Stickers Overlay */}
            <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
              {decorations.stickers.map((sticker) => {
                const isActive = activeStickerId === sticker.id;
                const isEmoji = /\p{Extended_Pictographic}/u.test(sticker.content);

                return (
                  <div
                    key={sticker.id}
                    style={{
                      left: `${sticker.x}%`,
                      top: `${sticker.y}%`,
                      transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                    }}
                    onPointerDown={(e) => handleStickerDrag(e, sticker)}
                    className="absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none group"
                  >
                    {isEmoji ? (
                      <span className="text-3xl filter drop-shadow-sm leading-none block">
                        {sticker.content}
                      </span>
                    ) : (
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded font-['Outfit',sans-serif] font-extrabold text-xs tracking-wider uppercase shadow-xs ${
                          isDarkFrame
                            ? 'bg-white/95 text-[#18181B]'
                            : 'bg-[#18181B]/90 text-white'
                        }`}
                      >
                        {sticker.content}
                      </span>
                    )}

                    {/* Sticker Control Bubble (when active or hover) */}
                    {(isActive || activeTab === 'stickers') && (
                      <div
                        className={`absolute -top-7 -right-7 ${
                          isActive ? 'flex' : 'hidden group-hover:flex'
                        } items-center gap-1 bg-black/85 backdrop-blur-xs p-1 rounded-md text-white scale-75 origin-top-left z-40 shadow-md`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotateSticker(sticker.id, sticker.rotation);
                          }}
                          className="p-1 hover:bg-white/20 rounded cursor-pointer"
                          title="Putar"
                        >
                          <Move className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScaleSticker(sticker.id, sticker.scale, 0.2);
                          }}
                          className="px-1 font-bold text-xs hover:bg-white/20 rounded cursor-pointer"
                          title="Perbesar"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScaleSticker(sticker.id, sticker.scale, -0.2);
                          }}
                          className="px-1 font-bold text-xs hover:bg-white/20 rounded cursor-pointer"
                          title="Perkecil"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSticker(sticker.id);
                          }}
                          className="p-1 hover:bg-rose-500 rounded cursor-pointer"
                          title="Hapus"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Studio Control Palette (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E7E2D9] p-5 md:p-6 shadow-sm">
          {/* Quick Korean Photobooth Theme Presets */}
          <div className="mb-5 p-3.5 rounded-xl bg-gradient-to-r from-rose-50/80 via-[#FFF9F6] to-indigo-50/60 border border-rose-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                <span>Preset Strip Korea (1-Klik Jadi)</span>
              </span>
              <span className="text-[10px] text-rose-500 font-medium">
                인기 테마
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {KOREAN_THEME_PRESETS.map((theme) => {
                const isActive =
                  decorations.frameColor === theme.frameColor &&
                  decorations.borderPattern === theme.borderPattern;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => {
                      onUpdateFrameDecorations({
                        frameColor: theme.frameColor,
                        borderPattern: theme.borderPattern,
                        filter: theme.filter,
                        captionText: theme.captionText,
                      });
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      isActive
                        ? 'border-rose-400 bg-white ring-2 ring-rose-300 shadow-xs'
                        : 'border-[#F1ECE7] bg-white/80 hover:bg-white hover:border-rose-200'
                    }`}
                  >
                    <div
                      style={{ backgroundColor: theme.frameColor }}
                      className="w-5 h-5 rounded-md border border-black/10 shrink-0 shadow-2xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-800 truncate leading-tight">
                        {theme.name}
                      </div>
                      <div className="text-[9px] text-rose-500 truncate leading-none">
                        {theme.koreanName}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Studio Category Tabs */}
          <div className="flex rounded-xl bg-[#F5F2EB] p-1 mb-6 text-xs font-semibold overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('filter')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'filter'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Filter Foto</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('frame')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'frame'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-rose-500" />
              <span>Warna Frame</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stickers')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stickers'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Smile className="w-3.5 h-3.5 text-rose-500" />
              <span>Stiker & Stamp</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('doodle')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'doodle'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 text-rose-500" />
              <span>Coret Doodle</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'text'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              <Type className="w-3.5 h-3.5 text-rose-500" />
              <span>Teks & Tanggal</span>
            </button>
          </div>

          {/* TAB 1: FILTERS */}
          {activeTab === 'filter' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                  Pilih Filter Warna Studio
                </span>
                <span className="text-xs text-rose-600 font-medium">
                  {currentFilter.name} · {currentFilter.koreanName}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FILTER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onUpdateFrameDecorations({ filter: preset.id })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      decorations.filter === preset.id
                        ? 'border-rose-400 bg-rose-50/50 ring-1 ring-rose-400 font-bold'
                        : 'border-[#E7E2D9] bg-[#FAF7F2] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#1C1917]">{preset.name}</span>
                      {decorations.filter === preset.id && (
                        <Check className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </div>
                    <div className="text-[10px] text-rose-500 font-mono mb-1">
                      {preset.koreanName}
                    </div>
                    <p className="text-[10px] text-[#78716C] leading-snug">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: FRAMES & PATTERNS */}
          {activeTab === 'frame' && (
            <div className="space-y-6">
              <div>
                <span className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2.5">
                  Warna Bingkai Frame
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {FRAME_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => onUpdateFrameDecorations({ frameColor: color.hex })}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        decorations.frameColor === color.hex
                          ? 'border-rose-400 ring-2 ring-rose-400 scale-102'
                          : 'border-[#E7E2D9] hover:border-slate-400'
                      }`}
                    >
                      <div
                        style={{ backgroundColor: color.hex }}
                        className="w-8 h-8 rounded-full border border-black/10 shadow-xs"
                      />
                      <span className="text-[11px] font-medium text-[#1C1917] truncate w-full">
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2.5">
                  Pola Tekstur Bingkai
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PATTERN_PRESETS.map((pattern) => (
                    <button
                      key={pattern.id}
                      type="button"
                      onClick={() =>
                        onUpdateFrameDecorations({
                          borderPattern: pattern.id as FrameDecorations['borderPattern'],
                        })
                      }
                      className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                        decorations.borderPattern === pattern.id
                          ? 'border-rose-400 bg-rose-50/60 ring-1 ring-rose-400 font-bold text-rose-900'
                          : 'border-[#E7E2D9] bg-[#FAF7F2] hover:bg-white text-[#44403C]'
                      }`}
                    >
                      {pattern.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STICKERS */}
          {activeTab === 'stickers' && (
            <div className="space-y-5">
              <div>
                <span className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2">
                  Stamp Tipografi Korea (Klik untuk Tempel)
                </span>
                <div className="flex flex-wrap gap-2">
                  {STICKER_PRESETS.korean.map((stamp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        onAddSticker({
                          content: stamp,
                          type: 'stamp',
                          x: 50 + (Math.random() * 20 - 10),
                          y: 50 + (Math.random() * 20 - 10),
                          scale: 1,
                          rotation: Math.floor(Math.random() * 10 - 5),
                        })
                      }
                      className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-rose-50 hover:border-rose-300 border border-[#E7E2D9] rounded-lg text-xs font-bold font-['Outfit',sans-serif] text-[#1C1917] transition-all cursor-pointer active:scale-95"
                    >
                      {stamp}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2">
                  Stamp Bahasa Inggris
                </span>
                <div className="flex flex-wrap gap-2">
                  {STICKER_PRESETS.english.map((stamp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        onAddSticker({
                          content: stamp,
                          type: 'stamp',
                          x: 50 + (Math.random() * 20 - 10),
                          y: 50 + (Math.random() * 20 - 10),
                          scale: 1,
                          rotation: Math.floor(Math.random() * 10 - 5),
                        })
                      }
                      className="px-3 py-1.5 bg-[#FAF7F2] hover:bg-rose-50 hover:border-rose-300 border border-[#E7E2D9] rounded-lg text-xs font-bold font-['Outfit',sans-serif] text-[#1C1917] transition-all cursor-pointer active:scale-95"
                    >
                      {stamp}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-2">
                  Emoji & Doodle Lucu
                </span>
                <div className="grid grid-cols-8 gap-2">
                  {STICKER_PRESETS.doodles.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        onAddSticker({
                          content: emoji,
                          type: 'emoji',
                          x: 50 + (Math.random() * 20 - 10),
                          y: 50 + (Math.random() * 20 - 10),
                          scale: 1,
                          rotation: Math.floor(Math.random() * 20 - 10),
                        })
                      }
                      className="h-10 rounded-xl bg-[#FAF7F2] hover:bg-rose-50 border border-[#E7E2D9] hover:border-rose-300 flex items-center justify-center text-xl transition-all cursor-pointer active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-[#78716C] bg-rose-50/70 p-2.5 rounded-lg border border-rose-200">
                Tip: Geser (drag) stiker langsung di atas strip foto untuk mengatur posisinya. Arahkan kursor ke stiker untuk memutar, memperbesar, atau menghapus.
              </p>
            </div>
          )}

          {/* TAB 4: DOODLE DRAWING */}
          {activeTab === 'doodle' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                  Coret & Gambar Bebas
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onUndoDoodle}
                    disabled={decorations.doodles.length === 0}
                    className="px-2.5 py-1 text-xs font-medium text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF7F2] disabled:opacity-40 rounded-lg border border-[#E7E2D9] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClearDoodles}
                    disabled={decorations.doodles.length === 0}
                    className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 rounded-lg border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Semua</span>
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#57534E] mb-2">
                  Pilih Warna Kuas
                </span>
                <div className="flex items-center gap-2.5">
                  {[
                    '#F43F5E',
                    '#EC4899',
                    '#8B5CF6',
                    '#3B82F6',
                    '#10B981',
                    '#F59E0B',
                    '#FFFFFF',
                    '#18181B',
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPenColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-7 h-7 rounded-full border border-black/10 transition-transform cursor-pointer shadow-xs ${
                        penColor === color ? 'ring-2 ring-rose-500 scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#57534E]">
                    Ketebalan Garis ({penWidth}px)
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="14"
                  value={penWidth}
                  onChange={(e) => setPenWidth(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                Mode coret aktif! Gambar langsung di atas strip foto di sebelah kiri menggunakan mouse atau jari kamu.
              </div>
            </div>
          )}

          {/* TAB 5: TEXT & DATE */}
          {activeTab === 'text' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-1.5">
                  Keterangan Foto / Caption
                </label>
                <input
                  type="text"
                  value={decorations.captionText}
                  onChange={(e) =>
                    onUpdateFrameDecorations({ captionText: e.target.value })
                  }
                  placeholder="Misal: Our Special Day · Love You"
                  maxLength={40}
                  className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-[#1C1917]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C1917] uppercase tracking-wider mb-1.5">
                  Stempel Tanggal (Date Stamp)
                </label>
                <input
                  type="text"
                  value={decorations.dateStamp}
                  onChange={(e) =>
                    onUpdateFrameDecorations({ dateStamp: e.target.value })
                  }
                  placeholder="2026.10.14"
                  maxLength={20}
                  className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-[#1C1917]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
