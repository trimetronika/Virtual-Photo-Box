import React, { useState } from 'react';
import { Camera, Check, Copy, Sparkles, Users, ArrowLeft, Share2 } from 'lucide-react';
import { RoomState } from '../types';
import { getShareableRoomUrl } from '../utils/shareUtils';

interface HeaderProps {
  room: RoomState | null;
  userName: string;
  isHost: boolean;
  onLeaveRoom: () => void;
  onFinishAndPrint?: () => void;
  onOpenInviteModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  userName,
  onLeaveRoom,
  onFinishAndPrint,
  onOpenInviteModal,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!room) return;
    const url = getShareableRoomUrl(room.code);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E7E2D9] px-4 md:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shadow-xs">
            <Camera className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base md:text-lg font-bold tracking-tight text-[#1C1917] font-['Outfit',sans-serif] whitespace-nowrap">
              K-Photobox
            </span>
            <span className="text-xs text-rose-500/80 font-medium whitespace-nowrap hidden sm:inline">
              인생네컷 Together
            </span>
          </div>
        </div>

        {/* Zone 2: Room Metadata & Single-Line Info */}
        <div className="flex items-center gap-3 text-xs md:text-sm text-[#78716C] whitespace-nowrap overflow-x-auto no-scrollbar">
          {room ? (
            <>
              <div className="flex items-center gap-1.5 font-medium text-[#1C1917]">
                <Users className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Room</span>
                <span className="font-mono font-bold tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  {room.code}
                </span>
              </div>
              <span className="text-[#D6D3D1]" aria-hidden="true">·</span>
              
              {onOpenInviteModal ? (
                <button
                  onClick={onOpenInviteModal}
                  className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/80 cursor-pointer shrink-0 transition-colors"
                  title="Buka opsi undang teman"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Undang Teman</span>
                </button>
              ) : (
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 text-xs text-[#57534E] hover:text-[#1C1917] hover:underline cursor-pointer shrink-0 transition-colors"
                  title="Salin tautan room publik"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>
              )}

              <span className="text-[#D6D3D1] hidden sm:inline" aria-hidden="true">·</span>
              <span className="hidden sm:inline text-xs text-[#78716C]">
                {room.users.length} Orang ({room.users.map((u) => u.name).join(', ')})
              </span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[#78716C]">
              <span>Studio Virtual Foto Box</span>
              <span aria-hidden="true">·</span>
              <span>Online Realtime</span>
            </div>
          )}
        </div>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {room ? (
            <>
              {room.stage === 'editing' && onFinishAndPrint && (
                <button
                  onClick={onFinishAndPrint}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs md:text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer active:scale-98"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cetak Strip</span>
                </button>
              )}
              <button
                onClick={onLeaveRoom}
                className="px-2.5 py-1.5 text-xs text-[#78716C] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                title="Keluar dari sesi"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Keluar</span>
              </button>
            </>
          ) : (
            <div className="text-xs text-[#78716C] font-medium">
              {userName ? `Hai, ${userName}` : 'Siap Berfoto'}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
