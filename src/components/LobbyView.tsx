import React, { useEffect, useState } from 'react';
import { Camera, Users, User, ArrowRight, Heart, Sparkles, Split, Layers } from 'lucide-react';
import { CaptureMode } from '../types';
import { TEMPLATE_PRESETS } from '../utils/presets';

interface LobbyViewProps {
  onCreateRoom: (name: string, mode: CaptureMode) => void;
  onJoinRoom: (code: string, name: string) => void;
  onStartSolo: (name: string) => void;
  initialRoomCode?: string;
  errorMessage?: string | null;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  onStartSolo,
  initialRoomCode = '',
  errorMessage,
}) => {
  const [name, setName] = useState(() => {
    return localStorage.getItem('kbox_user_name') || 'Chingu';
  });
  const [joinCode, setJoinCode] = useState(initialRoomCode);
  const [selectedMode, setSelectedMode] = useState<CaptureMode>('split');
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'solo'>(
    initialRoomCode ? 'join' : 'create'
  );

  useEffect(() => {
    if (initialRoomCode) {
      setJoinCode(initialRoomCode);
      setActiveTab('join');
    }
  }, [initialRoomCode]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateRoom(name.trim(), selectedMode);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase(), name.trim());
  };

  const handleSolo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onStartSolo(name.trim());
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
      {/* Editorial Hero Intro */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-200/80 rounded-full text-xs font-semibold text-rose-600 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Korean Aesthetic Self-Photo Studio</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-[#1C1917] font-['Outfit',sans-serif] leading-tight">
          Virtual Photobox <br className="hidden sm:inline" />
          <span className="text-rose-500">Bareng dari Mana Saja</span>
        </h1>
        <p className="mt-3 text-sm md:text-base text-[#78716C] leading-relaxed">
          Foto box online realtime untuk pasangan atau sahabat di tempat terpisah.
          Kamera sinkron, countdown otomatis, stiker lucu, dan cetak strip estetik.
        </p>
      </div>

      {/* Main Interaction Card */}
      <div className="bg-white rounded-2xl border border-[#E7E2D9] shadow-sm p-6 md:p-8 max-w-xl mx-auto mb-14">
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {errorMessage}
          </div>
        )}

        {initialRoomCode && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                Undangan Room: <strong className="font-mono text-sm tracking-wider text-rose-700">{initialRoomCode}</strong>
              </span>
            </div>
            <span className="text-[11px] text-rose-600 bg-white/80 px-2 py-0.5 rounded font-medium">
              Siap Bergabung
            </span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-[#F5F2EB] p-1 mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#78716C] hover:text-[#1C1917]'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-rose-500" />
            <span>Buat Room Baru</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'join'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#78716C] hover:text-[#1C1917]'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>Gabung Room</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('solo')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'solo'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#78716C] hover:text-[#1C1917]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Mode Solo</span>
          </button>
        </div>

        {/* Nickname Input */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-[#44403C] uppercase tracking-wider mb-1.5">
            Nama Panggilan / Nickname
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Chingu / Nana"
            maxLength={20}
            className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white transition-all text-[#1C1917]"
            required
          />
        </div>

        {/* Tab 1: Create Room */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#44403C] uppercase tracking-wider mb-2">
                Pilih Mode Pengambilan Foto
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMode('split')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedMode === 'split'
                      ? 'border-rose-400 bg-rose-50/50 ring-1 ring-rose-400'
                      : 'border-[#E7E2D9] bg-[#FAF7F2] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Split className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-[#1C1917]">Split Kamera</span>
                  </div>
                  <p className="text-[11px] text-[#78716C] leading-snug">
                    Dua wajah digabung berdampingan dalam tiap frame foto. Cocok untuk couple!
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode('alternate')}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedMode === 'alternate'
                      ? 'border-rose-400 bg-rose-50/50 ring-1 ring-rose-400'
                      : 'border-[#E7E2D9] bg-[#FAF7F2] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-[#1C1917]">Ganti Slot</span>
                  </div>
                  <p className="text-[11px] text-[#78716C] leading-snug">
                    Bergantian pose per slot foto (Slot 1 kamu, Slot 2 temanmu, dst).
                  </p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-3 px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-99"
            >
              <span>Buat Room & Dapatkan Link Undangan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 2: Join Room */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#44403C] uppercase tracking-wider mb-1.5">
                Kode Room (6 Digit)
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Misal: KBOX88"
                maxLength={8}
                className="w-full px-4 py-2.5 bg-[#FAF7F2] border border-[#E7E2D9] rounded-xl text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white transition-all text-[#1C1917]"
                required
              />
              <p className="mt-1 text-[11px] text-[#78716C]">
                Masukkan 6 digit kode yang dibagikan oleh temanmu.
              </p>
            </div>

            <button
              type="submit"
              disabled={!name.trim() || !joinCode.trim()}
              className="w-full py-3 px-4 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-99"
            >
              <span>Gabung ke Room Photobox</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Tab 3: Solo Mode */}
        {activeTab === 'solo' && (
          <form onSubmit={handleSolo} className="space-y-5">
            <p className="text-xs text-[#78716C] bg-[#FAF7F2] p-3 rounded-xl border border-[#E7E2D9]">
              Mode mandiri untuk mengambil foto strip sendiri dengan kamera laptop atau HP kamu, lengkap dengan filter dan stiker studio Korea.
            </p>
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-3 px-4 bg-[#1C1917] hover:bg-black disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-99"
            >
              <Camera className="w-4 h-4" />
              <span>Mulai Foto Sendiri</span>
            </button>
          </form>
        )}
      </div>

      {/* Showcase Template Strip Layouts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-bold text-[#1C1917] font-['Outfit',sans-serif]">
            Pilihan Layout Strip Foto
          </h2>
          <span className="text-xs text-[#78716C]">
            Tersedia 5 format klasik & modern
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {TEMPLATE_PRESETS.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white rounded-xl border border-[#E7E2D9] p-3 text-center transition-all hover:border-rose-300 hover:shadow-xs"
            >
              <div className="h-28 bg-[#FAF7F2] rounded-lg border border-dashed border-[#D6D3D1] flex flex-col items-center justify-center p-2 mb-2">
                {tmpl.layoutType === 'vertical' && (
                  <div className="w-8 flex flex-col gap-1">
                    {Array.from({ length: tmpl.slotCount }).map((_, i) => (
                      <div key={i} className="h-4 bg-rose-200/80 rounded-xs" />
                    ))}
                  </div>
                )}
                {tmpl.layoutType === 'grid' && (
                  <div className="w-12 h-12 grid grid-cols-2 gap-1">
                    <div className="bg-rose-200/80 rounded-xs" />
                    <div className="bg-rose-200/80 rounded-xs" />
                    <div className="bg-rose-200/80 rounded-xs" />
                    <div className="bg-rose-200/80 rounded-xs" />
                  </div>
                )}
                {tmpl.layoutType === 'postcard' && (
                  <div className="w-16 h-10 flex gap-1">
                    <div className="flex-1 bg-rose-200/80 rounded-xs" />
                    <div className="flex-1 bg-rose-200/80 rounded-xs" />
                  </div>
                )}
                {tmpl.layoutType === 'polaroid' && (
                  <div className="w-12 h-14 bg-white border border-rose-300 p-1 flex flex-col">
                    <div className="h-8 bg-rose-200/80 rounded-xs mb-1" />
                    <div className="h-1 bg-rose-300 rounded-full w-2/3 mx-auto" />
                  </div>
                )}
              </div>
              <h3 className="text-xs font-bold text-[#1C1917] truncate">{tmpl.name}</h3>
              <p className="text-[10px] text-rose-600 font-medium font-mono">{tmpl.koreanName}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
