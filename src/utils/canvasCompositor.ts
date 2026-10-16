import { FrameDecorations, PhotoSlot, TemplateConfig } from '../types';
import { FILTER_PRESETS } from './presets';

interface CompositeOptions {
  template: TemplateConfig;
  slots: PhotoSlot[];
  decorations: FrameDecorations;
  scale?: number; // 2 for crisp HD print
  captureMode?: 'split' | 'alternate' | 'solo';
}

// Helper to load image safely
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

// Rounded rectangle path helper
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderPhotostripCanvas(options: CompositeOptions): Promise<HTMLCanvasElement> {
  const { template, slots, decorations, scale = 2, captureMode = 'split' } = options;

  const canvas = document.createElement('canvas');
  const width = template.widthPx * scale;
  const height = template.heightPx * scale;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 1. Draw Frame Background
  ctx.fillStyle = decorations.frameColor;
  ctx.fillRect(0, 0, width, height);

  // 1.1 Draw Border Pattern if selected
  if (decorations.borderPattern === 'checkered') {
    const checkSize = 16 * scale;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    for (let x = 0; x < width; x += checkSize * 2) {
      for (let y = 0; y < height; y += checkSize * 2) {
        ctx.fillRect(x, y, checkSize, checkSize);
        ctx.fillRect(x + checkSize, y + checkSize, checkSize, checkSize);
      }
    }
  } else if (decorations.borderPattern === 'dots') {
    const dotGap = 24 * scale;
    const dotRadius = 2.5 * scale;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let x = dotGap / 2; x < width; x += dotGap) {
      for (let y = dotGap / 2; y < height; y += dotGap) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (decorations.borderPattern === 'clouds') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    const cloudStep = 60 * scale;
    for (let x = 20 * scale; x < width; x += cloudStep) {
      for (let y = 20 * scale; y < height; y += cloudStep) {
        ctx.beginPath();
        ctx.arc(x, y, 12 * scale, 0, Math.PI * 2);
        ctx.arc(x + 10 * scale, y - 4 * scale, 15 * scale, 0, Math.PI * 2);
        ctx.arc(x + 20 * scale, y, 12 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (decorations.borderPattern === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(0.5, 'transparent');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Compute Slot Layout Geometry
  const paddingX = 22 * scale;
  const paddingTop = 26 * scale;
  const paddingBottom = 96 * scale; // Room for Korean stamp, caption, and date
  const slotRadius = 8 * scale;

  interface SlotBox {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  const slotBoxes: SlotBox[] = [];

  if (template.layoutType === 'vertical') {
    const gap = 12 * scale;
    const availableHeight = height - paddingTop - paddingBottom;
    const slotW = width - paddingX * 2;
    const slotH = (availableHeight - gap * (template.slotCount - 1)) / template.slotCount;

    for (let i = 0; i < template.slotCount; i++) {
      slotBoxes.push({
        x: paddingX,
        y: paddingTop + i * (slotH + gap),
        w: slotW,
        h: slotH,
      });
    }
  } else if (template.layoutType === 'grid') {
    // 2x2 grid
    const gap = 12 * scale;
    const availableHeight = height - paddingTop - paddingBottom;
    const slotW = (width - paddingX * 2 - gap) / 2;
    const slotH = (availableHeight - gap) / 2;

    slotBoxes.push({ x: paddingX, y: paddingTop, w: slotW, h: slotH });
    slotBoxes.push({ x: paddingX + slotW + gap, y: paddingTop, w: slotW, h: slotH });
    slotBoxes.push({ x: paddingX, y: paddingTop + slotH + gap, w: slotW, h: slotH });
    slotBoxes.push({ x: paddingX + slotW + gap, y: paddingTop + slotH + gap, w: slotW, h: slotH });
  } else if (template.layoutType === 'postcard') {
    // 2 photos side by side
    const gap = 14 * scale;
    const availableHeight = height - paddingTop - paddingBottom;
    const slotW = (width - paddingX * 2 - gap) / 2;
    const slotH = availableHeight;

    slotBoxes.push({ x: paddingX, y: paddingTop, w: slotW, h: slotH });
    slotBoxes.push({ x: paddingX + slotW + gap, y: paddingTop, w: slotW, h: slotH });
  } else if (template.layoutType === 'polaroid') {
    // 1 big photo
    const slotW = width - paddingX * 2;
    const slotH = height - paddingTop - (140 * scale);
    slotBoxes.push({ x: paddingX, y: paddingTop, w: slotW, h: slotH });
  }

  // 3. Draw Each Photo Slot
  const filterPreset = FILTER_PRESETS.find((f) => f.id === decorations.filter);
  const filterCss = filterPreset ? filterPreset.cssFilter : 'none';

  for (let i = 0; i < slotBoxes.length; i++) {
    const box = slotBoxes[i];
    const slot = slots[i];

    // Background placeholder for empty slot
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, slotRadius);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    ctx.clip();

    // Check if slot has photo data
    const hasPhotoA = !!slot?.photoDataA;
    const hasPhotoB = !!slot?.photoDataB;

    if (hasPhotoA || hasPhotoB) {
      ctx.filter = filterCss;

      if (captureMode === 'split' && hasPhotoA && hasPhotoB) {
        // Dual split-camera: left half photo A, right half photo B
        try {
          const [imgA, imgB] = await Promise.all([
            loadImage(slot.photoDataA!),
            loadImage(slot.photoDataB!),
          ]);

          const halfW = box.w / 2;

          // Draw Photo A on left half
          drawCover(ctx, imgA, box.x, box.y, halfW, box.h);

          // Draw Photo B on right half
          drawCover(ctx, imgB, box.x + halfW, box.y, halfW, box.h);

          // Subtle divider line between the two people
          ctx.filter = 'none';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.moveTo(box.x + halfW, box.y);
          ctx.lineTo(box.x + halfW, box.y + box.h);
          ctx.stroke();
        } catch {
          // If error loading, draw neutral box
        }
      } else {
        // Single user photo or alternating slot
        const singlePhotoSrc = slot.photoDataA || slot.photoDataB;
        if (singlePhotoSrc) {
          try {
            const img = await loadImage(singlePhotoSrc);
            drawCover(ctx, img, box.x, box.y, box.w, box.h);
          } catch {
            // fallback
          }
        }
      }
    } else {
      // Empty slot placeholder
      ctx.fillStyle = '#CBD5E1';
      ctx.font = `${14 * scale}px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Shot ${i + 1}`, box.x + box.w / 2, box.y + box.h / 2);
    }

    ctx.restore();

    // Subtle slot border outline
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, slotRadius);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();
    ctx.restore();
  }

  // 4. Draw Footer Branding (Korean studio typography, custom caption, date)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Determine text color based on frame brightness
  const isDarkFrame = decorations.frameColor === '#18181B' || decorations.frameColor === '#292524';
  const primaryTextColor = isDarkFrame ? '#FFFFFF' : '#1C1917';
  const secondaryTextColor = isDarkFrame ? '#A1A1AA' : '#78716C';

  const footerCenterY = height - (paddingBottom / 2);

  // Korean Studio Stamp Wordmark
  ctx.font = `700 ${15 * scale}px 'Outfit', 'Plus Jakarta Sans', sans-serif`;
  ctx.letterSpacing = `${2 * scale}px`;
  ctx.fillStyle = primaryTextColor;
  ctx.fillText(template.koreanName || '인생네컷', width / 2, footerCenterY - 14 * scale);

  // Custom Caption / Quote
  if (decorations.captionText) {
    ctx.font = `500 ${11 * scale}px 'Plus Jakarta Sans', sans-serif`;
    ctx.letterSpacing = 'normal';
    ctx.fillStyle = primaryTextColor;
    ctx.fillText(decorations.captionText, width / 2, footerCenterY + 4 * scale);
  }

  // Date and Time Stamp
  if (decorations.dateStamp) {
    ctx.font = `400 ${9 * scale}px 'Plus Jakarta Sans', monospace`;
    ctx.letterSpacing = `${1 * scale}px`;
    ctx.fillStyle = secondaryTextColor;
    ctx.fillText(decorations.dateStamp, width / 2, footerCenterY + 22 * scale);
  }
  ctx.restore();

  // 5. Draw Doodles
  if (decorations.doodles && decorations.doodles.length > 0) {
    ctx.save();
    for (const doodle of decorations.doodles) {
      if (!doodle.points || doodle.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = doodle.color;
      ctx.lineWidth = doodle.strokeWidth * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const firstPoint = doodle.points[0];
      ctx.moveTo((firstPoint.x / 100) * width, (firstPoint.y / 100) * height);

      for (let j = 1; j < doodle.points.length; j++) {
        const pt = doodle.points[j];
        ctx.lineTo((pt.x / 100) * width, (pt.y / 100) * height);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 6. Draw Stickers
  if (decorations.stickers && decorations.stickers.length > 0) {
    ctx.save();
    for (const sticker of decorations.stickers) {
      const centerX = (sticker.x / 100) * width;
      const centerY = (sticker.y / 100) * height;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((sticker.rotation * Math.PI) / 180);
      ctx.scale(sticker.scale, sticker.scale);

      // Check if sticker is emoji or text stamp
      const isEmoji = /\p{Extended_Pictographic}/u.test(sticker.content);

      if (isEmoji) {
        ctx.font = `${32 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sticker.content, 0, 0);
      } else {
        // Aesthetic typography stamp
        ctx.font = `800 ${14 * scale}px 'Outfit', 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(sticker.content);
        const stampW = textMetrics.width + 16 * scale;
        const stampH = 24 * scale;

        // Stamp badge background
        roundRect(ctx, -stampW / 2, -stampH / 2, stampW, stampH, 4 * scale);
        ctx.fillStyle = isDarkFrame ? 'rgba(255, 255, 255, 0.9)' : 'rgba(24, 24, 27, 0.88)';
        ctx.fill();

        ctx.fillStyle = isDarkFrame ? '#18181B' : '#FFFFFF';
        ctx.fillText(sticker.content, 0, 1 * scale);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  return canvas;
}

// Helper to draw an image centered and object-fit cover
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;

  let sW = img.width;
  let sH = img.height;
  let sX = 0;
  let sY = 0;

  if (imgRatio > boxRatio) {
    sW = img.height * boxRatio;
    sX = (img.width - sW) / 2;
  } else {
    sH = img.width / boxRatio;
    sY = (img.height - sH) / 2;
  }

  ctx.drawImage(img, sX, sY, sW, sH, x, y, w, h);
}
