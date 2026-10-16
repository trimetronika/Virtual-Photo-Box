import React, { useState } from 'react';
import { Check, Copy, Share2, Users, X, Sparkles, MessageCircle } from 'lucide-react';
import { getShareableRoomUrl, getShareMessage } from '../utils/shareUtils';

interface InviteModalProps {
  roomCode: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ roomCode, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const shareUrl = getShareableRoomUrl(roomCode);
  const shareMessage = getShareMessage(roomCode);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(shareMessage).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'K-Photobox Together',
          text: `Ayo foto bareng di K-Photobox! Kode Room: ${roomCode}`,
          url: shareUrl,
        });
      } catch {
        // Fallback to copy all
        handleCopyAll();
      }
    } else {
      handleCopyAll();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-7 shadow-2xl border border-[#E7E2D9] relative animate-[slideDown_0.3s_cubic-bezier(0.16,1,0.3,1)]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#78716C] hover:text-[#1C1917] hover:bg-[#FAF7F2] rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg md:text-xl font-extrabold text-[#1C1917] font-['Outfit',sans-serif]">
            Undang Teman atau Pasangan
          </h3>
          <p className="text-xs text-[#78716C] mt-1">
            Bagikan kode room atau tautan publik agar temanmu bisa langsung bergabung berfoto.
          </p>
        </div>

        {/* Section 1: Prominent 6-Digit Room Code */}
        <div className="bg-[#FAF7F2] p-4 rounded-2xl border border-[#E7E2D9] mb-4 text-center">
          <span className="text-[10px] uppercase font-bold text-[#78716C] tracking-wider block mb-1">
            Kode Room Anda
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl md:text-4xl font-extrabold font-mono tracking-widest text-rose-600">
              {roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2 bg-white hover:bg-rose-50 border border-[#E7E2D9] hover:border-rose-200 text-[#57534E] hover:text-rose-600 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Salin Kode Room"
            >
              {copiedCode ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-[#A8A29E] mt-1.5">
            Temanmu cukup membuka web dan memasukkan kode di atas pada tab &quot;Gabung Room&quot;.
          </p>
        </div>

        {/* Section 2: Direct Join Link */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-[#44403C] uppercase tracking-wider mb-1.5">
            Tautan Publik (Bisa Diakses Siapa Saja)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl text-xs text-[#57534E] truncate select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs active:scale-98"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 3: Share Message Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full py-2.5 px-4 bg-[#1C1917] hover:bg-black text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-98"
          >
            <Share2 className="w-4 h-4 text-rose-300" />
            <span>Bagikan via WhatsApp / Aplikasi Lain</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            className="w-full py-2.5 px-4 bg-white hover:bg-[#FAF7F2] border border-[#E7E2D9] text-[#57534E] rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Teks Undangan Tersalin Lengkap!</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Salin Format Pesan Lengkap</span>
              </>
            )}
          </button>
        </div>

        {/* Informative Note */}
        <div className="mt-4 pt-3 border-t border-[#E7E2D9] flex items-start gap-2 text-[11px] text-[#78716C] leading-snug">
          <Sparkles className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>
            Tautan sudah disesuaikan agar dapat dibuka langsung oleh pasangan atau temanmu di perangkat apa pun tanpa kendala error &quot;Page Not Found&quot;.
          </span>
        </div>
      </div>
    </div>
  );
};
