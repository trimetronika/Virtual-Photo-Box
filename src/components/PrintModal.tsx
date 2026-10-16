import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Download,
  Copy,
  Printer,
  Check,
  X,
  Sparkles,
  RotateCcw,
  Share2,
} from 'lucide-react';
import { RoomState } from '../types';
import { sounds } from '../utils/audio';
import { renderPhotostripCanvas } from '../utils/canvasCompositor';
import { TEMPLATE_PRESETS } from '../utils/presets';

interface PrintModalProps {
  room: RoomState;
  onClose: () => void;
  onResetSession: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  room,
  onClose,
  onResetSession,
}) => {
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRendering, setIsRendering] = useState(true);

  const currentTemplate =
    TEMPLATE_PRESETS.find((t) => t.id === room.templateId) || TEMPLATE_PRESETS[0];

  useEffect(() => {
    sounds.playDispenseSound();

    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F43F5E', '#FB7185', '#FDA4AF', '#E0E7FF', '#FEF3C7'],
      });
    } catch {
      // ignore
    }

    // Render HD Canvas
    renderPhotostripCanvas({
      template: currentTemplate,
      slots: room.slots,
      decorations: room.decorations,
      scale: 2.5, // Crisp 2.5x retina print scale
      captureMode: room.captureMode,
    })
      .then((canvas) => {
        const url = canvas.toDataURL('image/png', 1.0);
        setRenderedImageUrl(url);
        setIsRendering(false);
      })
      .catch((err) => {
        console.error('Error rendering photostrip:', err);
        setIsRendering(false);
      });
  }, [currentTemplate, room.slots, room.decorations, room.captureMode]);

  const handleDownload = () => {
    if (!renderedImageUrl) return;
    const a = document.createElement('a');
    a.href = renderedImageUrl;
    a.download = `k-photobox-${room.code}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyToClipboard = async () => {
    if (!renderedImageUrl) return;
    try {
      const response = await fetch(renderedImageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      // Fallback
      handleDownload();
    }
  };

  const handleShare = async () => {
    if (!renderedImageUrl) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        const response = await fetch(renderedImageUrl);
        const blob = await response.blob();
        const file = new File([blob], `k-photobox-${room.code}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `K-Photobox Strip - ${room.code}`,
            text: 'Lihat hasil foto photobox virtual kita bareng! 📸✨',
            files: [file],
          });
          return;
        } else {
          await navigator.share({
            title: `K-Photobox Strip - ${room.code}`,
            text: 'Lihat hasil foto photobox virtual kita bareng! 📸✨',
            url: window.location.href,
          });
          return;
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        console.warn('Share error:', e);
      }
    }
  };

  const handlePrint = () => {
    if (!renderedImageUrl) return;
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Cetak Strip - K-Photobox ${room.code}</title>
              <style>
                @page { margin: 10mm; }
                body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
                img { max-height: 98vh; max-width: 98vw; object-fit: contain; }
                @media print { body { background: none; } img { max-height: 100%; max-width: 100%; } }
              </style>
            </head>
            <body>
              <img src="${renderedImageUrl}" onload="setTimeout(() => { window.print(); }, 200);" />
            </body>
          </html>
        `);
        doc.close();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }
    } catch (err) {
      console.warn('Iframe print error, falling back to window.print():', err);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-[#E7E2D9] relative animate-[slideDown_0.35s_cubic-bezier(0.16,1,0.3,1)]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#78716C] hover:text-[#1C1917] hover:bg-[#FAF7F2] rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-xs font-semibold text-rose-600 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Strip Foto Virtual Selesai Dicetak</span>
          </div>
          <h3 className="text-xl md:text-2xl font-extrabold text-[#1C1917] font-['Outfit',sans-serif]">
            Kenangan Indah Kamu!
          </h3>
          <p className="text-xs text-[#78716C] mt-1">
            Unduh gambar resolusi tinggi untuk disimpan atau dicetak langsung.
          </p>
        </div>

        {/* Photostrip Dispenser Preview Frame */}
        <div className="bg-[#FAF7F2] rounded-2xl p-4 border border-[#E7E2D9] flex justify-center mb-6 overflow-hidden">
          {isRendering ? (
            <div className="py-24 text-center text-xs text-[#78716C]">
              <Sparkles className="w-6 h-6 text-rose-500 animate-spin mx-auto mb-2" />
              <span>Memproses Strip Ultra HD...</span>
            </div>
          ) : renderedImageUrl ? (
            <div className="relative group max-h-[380px] overflow-y-auto no-scrollbar rounded-xl shadow-md border border-black/10">
              <img
                src={renderedImageUrl}
                alt="Finished photostrip"
                className="w-auto h-auto max-h-[380px] object-contain"
              />
            </div>
          ) : null}
        </div>

        {/* Actions Grid */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isRendering || !renderedImageUrl}
              className="py-3 px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Download Gambar HD</span>
            </button>

            <button
              type="button"
              onClick={handleCopyToClipboard}
              disabled={isRendering || !renderedImageUrl}
              className="py-3 px-4 bg-[#FAF7F2] hover:bg-[#F5F2EB] border border-[#E7E2D9] text-[#1C1917] rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin ke Clipboard</span>
                </>
              )}
            </button>

            {typeof navigator !== 'undefined' && !!navigator.share && (
              <button
                type="button"
                onClick={handleShare}
                disabled={isRendering || !renderedImageUrl}
                className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 sm:col-span-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan ke Teman / Sosmed</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#E7E2D9]">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isRendering || !renderedImageUrl}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-[#FAF7F2] border border-[#E7E2D9] text-[#57534E] rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Kertas</span>
            </button>

            <button
              type="button"
              onClick={onResetSession}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-rose-50 border border-[#E7E2D9] hover:border-rose-200 text-[#57534E] hover:text-rose-600 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ambil Sesi Baru</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
