import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  FlipHorizontal,
  RefreshCw,
  Upload,
  Users,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Split,
  Layers,
  Volume2,
} from 'lucide-react';
import { CaptureMode, RoomState } from '../types';
import { sounds } from '../utils/audio';
import { TEMPLATE_PRESETS } from '../utils/presets';
import { getShareableRoomUrl } from '../utils/shareUtils';
import { PoseGuideBar } from './PoseGuideBar';

interface CameraBoothViewProps {
  room: RoomState;
  userId: string;
  isHost: boolean;
  onOpenInviteModal?: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  cameraError: string | null;
  isMirrored: boolean;
  onToggleMirror: () => void;
  onSwitchCamera: () => void;
  onCaptureSnapshot: () => string | null;
  onFileUpload: (file: File) => Promise<string>;
  onStartCountdown: (slotIndex: number) => void;
  onSubmitPhoto: (slotIndex: number, photoData: string, userRole: 'userA' | 'userB') => void;
  onClearSlot: (slotIndex: number) => void;
  onUpdateConfig: (config: Partial<{ templateId: string; captureMode: CaptureMode; countdownDuration: number; slotCount: number }>) => void;
  onProceedToDecor: () => void;
  countdownEvent: { slotIndex: number; duration: number; targetTimestamp: number } | null;
  onClearCountdown: () => void;
  peerLiveFrame: { userId: string; thumbnail: string } | null;
  onBroadcastLiveFrame: (thumb: string) => void;
  remoteStream?: MediaStream | null;
  onSuggestPose?: (poseId: string) => void;
}

export const CameraBoothView: React.FC<CameraBoothViewProps> = ({
  room,
  userId,
  isHost,
  onOpenInviteModal,
  videoRef,
  isStreaming,
  cameraError,
  isMirrored,
  onToggleMirror,
  onSwitchCamera,
  onCaptureSnapshot,
  onFileUpload,
  onStartCountdown,
  onSubmitPhoto,
  onClearSlot,
  onUpdateConfig,
  onProceedToDecor,
  countdownEvent,
  onClearCountdown,
  peerLiveFrame,
  onBroadcastLiveFrame,
  remoteStream,
  onSuggestPose,
}) => {
  const [copied, setCopied] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [countdownNumber, setCountdownNumber] = useState<number | null>(null);
  const [isPartnerVideoPlaying, setIsPartnerVideoPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const partnerVideoRef = useRef<HTMLVideoElement | null>(null);
  const broadcastIntervalRef = useRef<number | null>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const video = partnerVideoRef.current;
    if (video && remoteStream) {
      video.srcObject = remoteStream;
      video.muted = true;
      video.playsInline = true;

      const handlePlaying = () => setIsPartnerVideoPlaying(true);
      const handleStop = () => setIsPartnerVideoPlaying(false);

      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleStop);
      video.addEventListener('stalled', handleStop);
      video.addEventListener('error', handleStop);

      video.onloadedmetadata = () => {
        video.play().catch(() => {});
      };
      video.play().catch(() => {});

      return () => {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('waiting', handleStop);
        video.removeEventListener('stalled', handleStop);
        video.removeEventListener('error', handleStop);
      };
    } else {
      setIsPartnerVideoPlaying(false);
    }
  }, [remoteStream]);

  const currentTemplate =
    TEMPLATE_PRESETS.find((t) => t.id === room.templateId) || TEMPLATE_PRESETS[0];

  const userRole: 'userA' | 'userB' =
    isHost || room.hostId === userId ? 'userA' : 'userB';
  const partnerUser = room.users.find((u) => u.id !== userId);

  // Check if slot has required photos
  const isSlotFilled = (slotIdx: number) => {
    const slot = room.slots[slotIdx];
    if (!slot) return false;
    return Boolean(slot.photoDataA || slot.photoDataB);
  };

  // Find next unfilled slot
  const nextUnfilledSlotIndex = room.slots.findIndex((_, idx) => !isSlotFilled(idx));
  const allSlotsFilled =
    room.slots.length > 0 && room.slots.every((_, idx) => isSlotFilled(idx));

  // Determine current active slot and whose turn it is
  const activeSlot = countdownEvent
    ? countdownEvent.slotIndex
    : room.activeSlotIndex ?? (nextUnfilledSlotIndex !== -1 ? nextUnfilledSlotIndex : 0);
  const currentTurnRole: 'userA' | 'userB' = activeSlot % 2 === 0 ? 'userA' : 'userB';
  const isMyTurnForActiveSlot =
    room.captureMode !== 'alternate' || userRole === currentTurnRole;
  const hostUser = room.users.find((u) => u.id === room.hostId) || room.users[0];
  const turnUserName =
    currentTurnRole === 'userA'
      ? hostUser?.name || 'Host'
      : partnerUser?.name || 'Partner';

  // Fast smooth thumbnail broadcast (every 350ms = ~3 FPS) for reliable zero-freeze standby preview
  useEffect(() => {
    if (room.captureMode === 'solo' || room.users.length < 2) return;

    if (!thumbCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 240;
      c.height = 180;
      thumbCanvasRef.current = c;
    }

    broadcastIntervalRef.current = window.setInterval(() => {
      if (videoRef.current && isStreaming) {
        try {
          const video = videoRef.current;
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const canvas = thumbCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.save();
              if (isMirrored) {
                ctx.translate(240, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(video, 0, 0, 240, 180);
              ctx.restore();
              const thumb = canvas.toDataURL('image/jpeg', 0.45);
              onBroadcastLiveFrame(thumb);
            }
          }
        } catch {
          // ignore
        }
      }
    }, 350);

    return () => {
      if (broadcastIntervalRef.current) {
        clearInterval(broadcastIntervalRef.current);
      }
    };
  }, [room.captureMode, room.users.length, videoRef, isStreaming, isMirrored, onBroadcastLiveFrame]);

  // Handle synchronized countdown timer
  useEffect(() => {
    if (!countdownEvent) return;

    const { slotIndex, targetTimestamp } = countdownEvent;
    let timerId: number;

    const tick = () => {
      const now = Date.now();
      const remainingMs = targetTimestamp - now;
      const secondsLeft = Math.ceil(remainingMs / 1000);

      if (secondsLeft > 0) {
        setCountdownNumber(secondsLeft);
        sounds.playCountdownBeep(secondsLeft === 1);
        timerId = window.setTimeout(tick, Math.min(1000, remainingMs % 1000 || 1000));
      } else {
        // Shutter snap time!
        setCountdownNumber(0);
        sounds.playShutterSound();
        setFlashActive(true);

        const slotTurnRole: 'userA' | 'userB' = slotIndex % 2 === 0 ? 'userA' : 'userB';
        const isMyTurn =
          room.captureMode !== 'alternate' || userRole === slotTurnRole;

        if (isMyTurn) {
          const snap = onCaptureSnapshot();
          if (snap) {
            onSubmitPhoto(slotIndex, snap, userRole);
          }
        }

        setTimeout(() => {
          setFlashActive(false);
          setCountdownNumber(null);
          onClearCountdown();
        }, 500);
      }
    };

    tick();

    return () => {
      clearTimeout(timerId);
    };
  }, [
    countdownEvent,
    onCaptureSnapshot,
    onSubmitPhoto,
    userRole,
    onClearCountdown,
    room.captureMode,
  ]);

  const handleCopyLink = () => {
    if (onOpenInviteModal) {
      onOpenInviteModal();
      return;
    }
    const url = getShareableRoomUrl(room.code);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUrl = await onFileUpload(file);
        onSubmitPhoto(room.activeSlotIndex, dataUrl, userRole);
      } catch (err) {
        console.error('File upload failed:', err);
      }
    }
  };

  const handleStartCaptureForSlot = (slotIdx: number) => {
    onStartCountdown(slotIdx);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Screen Flash Animation */}
      {flashActive && (
        <div className="fixed inset-0 z-50 bg-white pointer-events-none animate-[ping_0.4s_ease-out_forwards]" />
      )}

      {/* Top Banner for Waiting Partner */}
      {room.captureMode !== 'solo' && room.users.length < 2 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs md:text-sm text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Menunggu pasangan atau teman bergabung ke Room{' '}
              <strong className="font-mono text-amber-800">{room.code}</strong>...
            </span>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-bold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Link Undangan</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Studio Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Camera & Split Viewport (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-3 sm:gap-4">
          {/* Prominent Turn Instruction Banner for Alternate Mode */}
          {room.captureMode === 'alternate' && (
            <div
              className={`rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-sm border transition-all ${
                isMyTurnForActiveSlot
                  ? 'bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 text-white border-rose-400 ring-2 ring-rose-400/40 shadow-rose-200'
                  : 'bg-gradient-to-r from-amber-50 to-orange-50 text-[#1C1917] border-amber-300 ring-1 ring-amber-300/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    isMyTurnForActiveSlot
                      ? 'bg-white/20 text-white animate-pulse'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs sm:text-base font-extrabold tracking-tight ${
                        isMyTurnForActiveSlot ? 'text-white' : 'text-[#1C1917]'
                      }`}
                    >
                      {isMyTurnForActiveSlot
                        ? `✨ GILIRANMU BERPOSE! (Shot #${activeSlot + 1})`
                        : `⏳ GILIRAN ${turnUserName.toUpperCase()} BERPOSE (Shot #${activeSlot + 1})`}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold ${
                        isMyTurnForActiveSlot
                          ? 'bg-white text-rose-600 shadow-xs'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {isMyTurnForActiveSlot ? '📸 KAMERA AKTIF' : 'MENUNGGU TEMAN'}
                    </span>
                  </div>
                  <p
                    className={`text-xs sm:text-[13px] truncate mt-0.5 font-medium ${
                      isMyTurnForActiveSlot ? 'text-rose-100' : 'text-[#78716C]'
                    }`}
                  >
                    {isMyTurnForActiveSlot
                      ? 'Arahkan gayamu ke kamera sekarang! Klik tombol ambil foto di bawah jika sudah siap.'
                      : `Temanmu (${turnUserName}) sedang bersiap di Shot #${activeSlot + 1}. Giliranmu setelah ini!`}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 hidden md:block">
                <span
                  className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg ${
                    isMyTurnForActiveSlot
                      ? 'bg-black/20 text-white'
                      : 'bg-white border border-amber-200 text-amber-800'
                  }`}
                >
                  Shot {activeSlot + 1} / {currentTemplate.slotCount}
                </span>
              </div>
            </div>
          )}

          <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 md:aspect-16/10 shadow-md border border-[#E7E2D9] flex items-center justify-center">
            {/* Countdown Overlay with Turn Info */}
            {countdownNumber !== null && (
              <div className="absolute inset-0 z-30 bg-black/65 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center">
                {room.captureMode === 'alternate' && (
                  <div
                    className={`mb-3 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg backdrop-blur-md ${
                      isMyTurnForActiveSlot
                        ? 'bg-rose-500/90 text-white border border-rose-300 ring-2 ring-rose-400/50'
                        : 'bg-amber-500/90 text-white border border-amber-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>
                      {isMyTurnForActiveSlot
                        ? `📸 GILIRAN KAMU BERPOSE! (Shot #${activeSlot + 1})`
                        : `👀 GILIRAN ${turnUserName.toUpperCase()} POSE! (Shot #${activeSlot + 1})`}
                    </span>
                  </div>
                )}

                <span className="text-7xl md:text-9xl font-black font-['Outfit',sans-serif] tracking-wider animate-bounce drop-shadow-lg">
                  {countdownNumber === 0 ? 'SMILE!' : countdownNumber}
                </span>

                <span className="mt-2 text-xs md:text-sm tracking-widest text-rose-300 uppercase font-bold">
                  {countdownNumber === 0
                    ? isMyTurnForActiveSlot
                      ? '📸 Mengambil foto terbaikmu...'
                      : `📸 Mengambil foto ${turnUserName}...`
                    : isMyTurnForActiveSlot
                    ? 'Tunjukkan senyum / gayamu ke kamera!'
                    : `Menunggu ${turnUserName} berpose...`}
                </span>
              </div>
            )}

            {/* Camera Views: Split Mode OR Alternate Mode with 2 users */}
            {(room.captureMode === 'split' || room.captureMode === 'alternate') &&
            room.users.length >= 2 ? (
              <div className="w-full h-full grid grid-cols-2 relative divide-x divide-white/20">
                {/* Left Side: Local Camera */}
                <div
                  className={`relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden transition-all ${
                    room.captureMode === 'alternate' && isMyTurnForActiveSlot
                      ? 'ring-4 ring-rose-400 ring-inset shadow-[inset_0_0_20px_rgba(244,63,94,0.4)] z-10'
                      : ''
                  }`}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      isMirrored ? 'scale-x-[-1]' : ''
                    }`}
                  />
                  {/* Alternate Mode Overlay when waiting */}
                  {room.captureMode === 'alternate' && !isMyTurnForActiveSlot && (
                    <div className="absolute inset-0 bg-black/35 pointer-events-none flex items-center justify-center">
                      <span className="bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-md backdrop-blur-xs font-medium">
                        Giliranmu Berikutnya
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-medium z-20 flex items-center gap-1.5">
                    {room.captureMode === 'alternate' && isMyTurnForActiveSlot ? (
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                    <span>
                      Kamu ({userRole === 'userA' ? 'Host' : 'Partner'})
                    </span>
                    {room.captureMode === 'alternate' && isMyTurnForActiveSlot && (
                      <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                        Sedang Pose
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Side: Remote Peer Live Frame */}
                <div
                  className={`relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden transition-all ${
                    room.captureMode === 'alternate' && !isMyTurnForActiveSlot
                      ? 'ring-4 ring-rose-400 ring-inset shadow-[inset_0_0_20px_rgba(244,63,94,0.4)] z-10'
                      : ''
                  }`}
                >
                  {/* Remote video stream if connected and actively playing */}
                  {remoteStream && (
                    <video
                      ref={partnerVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover absolute inset-0 z-10 transition-opacity duration-300 ${
                        isPartnerVideoPlaying
                          ? 'opacity-100'
                          : 'opacity-0 pointer-events-none'
                      }`}
                    />
                  )}
                  {/* Realtime fallback thumbnail */}
                  {peerLiveFrame?.thumbnail ? (
                    <img
                      src={peerLiveFrame.thumbnail}
                      alt="Remote peer video"
                      className="w-full h-full object-cover absolute inset-0"
                    />
                  ) : !isPartnerVideoPlaying ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <Users className="w-8 h-8 mb-2 opacity-50 text-rose-400 animate-pulse" />
                      <span className="text-xs font-semibold text-white">
                        {partnerUser?.name || 'Partner'} terhubung
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">
                        Menghubungkan kamera...
                      </span>
                    </div>
                  ) : null}

                  {/* Alternate Mode Overlay when waiting */}
                  {room.captureMode === 'alternate' && isMyTurnForActiveSlot && (
                    <div className="absolute inset-0 bg-black/35 pointer-events-none z-15 flex items-center justify-center">
                      <span className="bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-md backdrop-blur-xs font-medium">
                        Menunggu Kamu Pose
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-medium z-20 flex items-center gap-1.5">
                    {room.captureMode === 'alternate' && !isMyTurnForActiveSlot ? (
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                    <span>{partnerUser?.name || 'Partner'}</span>
                    {room.captureMode === 'alternate' && !isMyTurnForActiveSlot && (
                      <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                        Sedang Pose
                      </span>
                    )}
                    {isPartnerVideoPlaying ? (
                      <span className="text-[9px] text-emerald-300 opacity-90 font-mono">
                        HD
                      </span>
                    ) : peerLiveFrame?.thumbnail ? (
                      <span className="text-[9px] text-rose-300 opacity-90 font-mono">
                        LIVE
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              /* Single / Solo Camera Viewport */
              <div className="relative w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    isMirrored ? 'scale-x-[-1]' : ''
                  }`}
                />
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 text-white flex flex-col items-center justify-center p-6 text-center">
                    <Camera className="w-10 h-10 text-rose-400 mb-2" />
                    <p className="text-sm font-semibold mb-1">Kamera Tidak Aktif</p>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">
                      Izinkan akses webcam pada browser atau gunakan tombol unggah foto di bawah ini.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Foto dari HP / Laptop</span>
                    </button>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-md font-medium">
                  {room.captureMode === 'alternate'
                    ? isMyTurnForActiveSlot
                      ? '✨ Giliranmu Pose!'
                      : `Giliran ${turnUserName} Pose...`
                    : 'Kamera Aktif'}
                </div>
              </div>
            )}

            {/* Floating Top Camera Controls */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              <button
                type="button"
                onClick={onToggleMirror}
                className="p-2 rounded-lg bg-black/50 hover:bg-black/80 text-white text-xs backdrop-blur-md transition-colors cursor-pointer"
                title="Cerminkan Kamera (Mirror)"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onSwitchCamera}
                className="p-2 rounded-lg bg-black/50 hover:bg-black/80 text-white text-xs backdrop-blur-md transition-colors cursor-pointer"
                title="Ganti Kamera Depan / Belakang"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg bg-black/50 hover:bg-black/80 text-white text-xs backdrop-blur-md transition-colors cursor-pointer"
                title="Unggah Foto dari Galeri"
              >
                <Upload className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUploadChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Dynamic Korean Photobooth Pose Guide */}
          <PoseGuideBar
            activePoseId={room.activePoseId}
            onSelectPose={(poseId) => {
              if (onSuggestPose) {
                onSuggestPose(poseId);
              }
            }}
            userRole={userRole}
            userName={userRole === 'userA' ? hostUser?.name || 'Kamu' : partnerUser?.name || 'Kamu'}
            partnerName={userRole === 'userA' ? partnerUser?.name || 'Partner' : hostUser?.name || 'Host'}
            isMultiUser={room.users.length > 1}
            captureMode={room.captureMode}
          />

          {/* Shutter Deck & Action Controls */}
          <div className="bg-white rounded-2xl border border-[#E7E2D9] p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[#78716C]">
              <Volume2 className="w-4 h-4 text-rose-500" />
              <span>
                Timer: <strong>{room.countdownDuration || 3} Detik</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Mode: <strong>{room.captureMode === 'split' ? 'Split Kamera' : room.captureMode === 'alternate' ? 'Ganti Slot' : 'Solo'}</strong>
              </span>
            </div>

            {/* Shutter Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                disabled={countdownNumber !== null}
                onClick={() => {
                  const targetSlot =
                    nextUnfilledSlotIndex !== -1 ? nextUnfilledSlotIndex : 0;
                  handleStartCaptureForSlot(targetSlot);
                }}
                className={`flex-1 sm:flex-none px-6 py-3.5 text-white rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50 ${
                  room.captureMode === 'alternate' && isMyTurnForActiveSlot
                    ? 'bg-rose-500 hover:bg-rose-600 ring-2 ring-rose-300'
                    : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>
                  {countdownNumber !== null
                    ? 'Bersiap...'
                    : room.captureMode === 'alternate'
                    ? isMyTurnForActiveSlot
                      ? `Ambil Shot #${activeSlot + 1} (Giliranku Pose!)`
                      : `Mulai Shot #${activeSlot + 1} (Giliran ${turnUserName})`
                    : `Ambil Shot ${nextUnfilledSlotIndex !== -1 ? nextUnfilledSlotIndex + 1 : 1}`}
                </span>
              </button>

              {allSlotsFilled && (
                <button
                  type="button"
                  onClick={onProceedToDecor}
                  className="px-5 py-3.5 bg-[#1C1917] hover:bg-black text-white rounded-xl font-bold text-sm shadow-sm flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-rose-300" />
                  <span>Dekorasi Strip</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Template Chooser & Slot Progress Strip (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Template Configuration */}
          <div className="bg-white rounded-2xl border border-[#E7E2D9] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Layout Strip
              </span>
              <span className="text-xs text-rose-600 font-mono font-medium">
                {currentTemplate.koreanName}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {TEMPLATE_PRESETS.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      templateId: tmpl.id,
                      slotCount: tmpl.slotCount,
                    })
                  }
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    room.templateId === tmpl.id
                      ? 'border-rose-400 bg-rose-50/60 ring-1 ring-rose-400 font-bold'
                      : 'border-[#E7E2D9] bg-[#FAF7F2] hover:bg-white text-[#57534E]'
                  }`}
                >
                  <div className="text-[11px] truncate">{tmpl.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-[#A8A29E]">{tmpl.slotCount} Foto</div>
                </button>
              ))}
            </div>

            {/* Mode Toggle (if Host and Multi-user) */}
            {isHost && room.captureMode !== 'solo' && (
              <div className="pt-2 border-t border-[#E7E2D9] flex items-center justify-between gap-2">
                <span className="text-xs text-[#78716C]">Mode Pengambilan:</span>
                <div className="flex rounded-lg bg-[#FAF7F2] p-1 border border-[#E7E2D9] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ captureMode: 'split' })}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      room.captureMode === 'split' ? 'bg-white shadow-xs text-rose-600 font-bold' : 'text-[#78716C]'
                    }`}
                  >
                    <Split className="w-3 h-3" />
                    <span>Split</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateConfig({ captureMode: 'alternate' })}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      room.captureMode === 'alternate' ? 'bg-white shadow-xs text-rose-600 font-bold' : 'text-[#78716C]'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Ganti</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Captured Slots Preview */}
          <div className="bg-white rounded-2xl border border-[#E7E2D9] p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#1C1917] uppercase tracking-wider">
                Progres Foto ({room.slots.filter((s) => s.photoDataA || s.photoDataB).length}/{currentTemplate.slotCount})
              </span>
              {allSlotsFilled && (
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  Lengkap!
                </span>
              )}
            </div>

            {room.captureMode === 'alternate' && (
              <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-rose-50/70 border border-rose-200/80 text-[11px] text-rose-900 flex items-center justify-between">
                <span>🔄 <strong>Aturan Bergantian:</strong></span>
                <span className="font-mono text-[10px]">
                  #Ganjil: Host · #Genap: Partner
                </span>
              </div>
            )}

            {/* Slots List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {Array.from({ length: currentTemplate.slotCount }).map((_, idx) => {
                const slot = room.slots[idx];
                const hasPhoto = Boolean(slot?.photoDataA || slot?.photoDataB);

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      hasPhoto
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : room.activeSlotIndex === idx
                        ? 'border-rose-400 bg-rose-50/40 ring-1 ring-rose-400'
                        : 'border-[#E7E2D9] bg-[#FAF7F2]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-12 rounded-lg bg-[#E2E8F0] overflow-hidden border border-[#CBD5E1] shrink-0 flex items-center justify-center">
                      {hasPhoto ? (
                        <div className="w-full h-full flex overflow-hidden">
                          {room.captureMode === 'split' ? (
                            <>
                              {slot?.photoDataA && (
                                <img
                                  src={slot.photoDataA}
                                  alt={`Slot ${idx + 1} A`}
                                  className={`${
                                    slot?.photoDataB ? 'w-1/2' : 'w-full'
                                  } h-full object-cover`}
                                />
                              )}
                              {slot?.photoDataB && (
                                <img
                                  src={slot.photoDataB}
                                  alt={`Slot ${idx + 1} B`}
                                  className={`${
                                    slot?.photoDataA ? 'w-1/2' : 'w-full'
                                  } h-full object-cover border-l border-white/50`}
                                />
                              )}
                            </>
                          ) : (
                            /* Alternate or Solo: Render whichever photo is stored */
                            <img
                              src={slot?.photoDataB || slot?.photoDataA}
                              alt={`Slot ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-[#94A3B8]">#{idx + 1}</span>
                      )}
                    </div>

                    {/* Slot Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-xs font-bold text-[#1C1917] truncate">
                          Shot #{idx + 1}
                        </div>
                        {room.captureMode === 'alternate' && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              idx % 2 === 0
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {idx % 2 === 0 ? 'Host' : 'Partner'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px]">
                        {slot?.photoDataA && slot?.photoDataB && room.captureMode === 'split' ? (
                          <span className="text-emerald-600 font-semibold">✓ 2 Orang Lengkap (Split)</span>
                        ) : slot?.photoDataA && room.captureMode === 'split' && room.users.length >= 2 ? (
                          <span className="text-amber-600 font-medium">Foto Host tersimpan (menunggu partner...)</span>
                        ) : slot?.photoDataB && room.captureMode === 'split' && room.users.length >= 2 ? (
                          <span className="text-amber-600 font-medium">Foto Partner tersimpan (menunggu host...)</span>
                        ) : hasPhoto ? (
                          <span className="text-emerald-600 font-semibold">
                            ✓ Foto {slot?.userBName || slot?.userAName || 'Tersimpan'}
                          </span>
                        ) : room.captureMode === 'alternate' ? (
                          <span
                            className={
                              idx % 2 === (userRole === 'userA' ? 0 : 1)
                                ? 'text-rose-600 font-bold'
                                : 'text-[#78716C]'
                            }
                          >
                            {idx % 2 === (userRole === 'userA' ? 0 : 1)
                              ? '👉 Giliranmu pose'
                              : `Giliran ${idx % 2 === 0 ? 'Host' : 'Partner'}`}
                          </span>
                        ) : (
                          <span className="text-[#A8A29E]">Belum diambil</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {hasPhoto ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClearSlot(idx);
                            handleStartCaptureForSlot(idx);
                          }}
                          className="p-1.5 text-xs text-[#78716C] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Ambil Ulang (Retake)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartCaptureForSlot(idx)}
                          className="px-2.5 py-1 text-xs bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Foto
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Button to Proceed */}
            {allSlotsFilled && (
              <button
                type="button"
                onClick={onProceedToDecor}
                className="w-full mt-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Masuk ke Studio Dekorasi</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
