import { useEffect, useState } from 'react';
import { CameraBoothView } from './components/CameraBoothView';
import { DecorationStudioView } from './components/DecorationStudioView';
import { Header } from './components/Header';
import { InviteModal } from './components/InviteModal';
import { LobbyView } from './components/LobbyView';
import { PrintModal } from './components/PrintModal';
import { ReactionsOverlay } from './components/ReactionsOverlay';
import { usePhotoboxSocket } from './hooks/usePhotoboxSocket';
import { useWebcam } from './hooks/useWebcam';
import { CaptureMode } from './types';

export default function App() {
  const [initialRoomCode, setInitialRoomCode] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Check URL query parameters and path on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const pathMatch = window.location.pathname.match(/\/room\/([a-zA-Z0-9]+)/i);

    const code = roomParam || (pathMatch ? pathMatch[1] : null);
    if (code) {
      setInitialRoomCode(code.toUpperCase());
    }
  }, []);

  // Local webcam hook
  const {
    videoRef,
    stream,
    isStreaming,
    error: cameraError,
    isMirrored,
    toggleMirror,
    switchCamera,
    captureSnapshot,
    handleFileUpload,
  } = useWebcam();

  // Web socket / WebRTC hook for real-time multiplayer photobox
  const {
    userId,
    userName,
    isHost,
    room,
    error: socketError,
    isReconnecting,
    reconnectAttempt,
    reconnect,
    reactions,
    peerLiveFrame,
    remoteStream,
    countdownEvent,
    setCountdownEvent,
    createRoom,
    joinRoom,
    updateRoomConfig,
    setStage,
    startCountdown,
    submitPhoto,
    clearSlot,
    updateFrameDecorations,
    addSticker,
    updateSticker,
    removeSticker,
    addDoodleStroke,
    undoDoodle,
    clearDoodles,
    sendReaction,
    broadcastLiveFrame,
    suggestPose,
  } = usePhotoboxSocket(stream);

  // Handle room creation
  const handleCreateRoom = (name: string, mode: CaptureMode) => {
    createRoom(name, mode);
  };

  // Handle joining room
  const handleJoinRoom = (code: string, name: string) => {
    joinRoom(code, name);
  };

  // Handle start solo booth
  const handleStartSolo = (name: string) => {
    createRoom(name, 'solo');
  };

  // Leave room
  const handleLeaveRoom = () => {
    window.location.href = window.location.pathname;
  };

  // Reset session to take new photos
  const handleResetSession = () => {
    setIsPrintModalOpen(false);
    if (room) {
      room.slots.forEach((_, idx) => clearSlot(idx));
      clearDoodles();
      setStage('ready', 0);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navigation Bar */}
      <Header
        room={room}
        userName={userName}
        isHost={isHost}
        onLeaveRoom={handleLeaveRoom}
        onFinishAndPrint={() => setIsPrintModalOpen(true)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
      />

      {/* Network Reconnect & Resilience Notification */}
      {room && isReconnecting && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold shadow-xs z-30 transition-all">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>
                Koneksi terputus sesaat. Menyambungkan kembali ke room {room.code}... (Percobaan {reconnectAttempt}/5)
              </span>
            </div>
            <button
              type="button"
              onClick={reconnect}
              className="bg-white text-amber-900 px-2.5 py-1 rounded-md text-xs font-bold hover:bg-amber-50 transition-colors cursor-pointer shrink-0"
            >
              Sambungkan Sekarang
            </button>
          </div>
        </div>
      )}

      {room && !isReconnecting && socketError && (
        <div className="bg-rose-500 text-white px-4 py-2 text-xs font-semibold shadow-xs z-30 transition-all">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <span>{socketError}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={reconnect}
                className="bg-white text-rose-900 px-2.5 py-1 rounded-md text-xs font-bold hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Coba Sambung Ulang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Viewport Router */}
      <main className="flex-1">
        {!room ? (
          <LobbyView
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartSolo={handleStartSolo}
            initialRoomCode={initialRoomCode}
            errorMessage={socketError}
          />
        ) : room.stage === 'editing' || room.stage === 'finished' ? (
          <DecorationStudioView
            room={room}
            userId={userId}
            onUpdateFrameDecorations={updateFrameDecorations}
            onAddSticker={addSticker}
            onUpdateSticker={updateSticker}
            onRemoveSticker={removeSticker}
            onAddDoodleStroke={addDoodleStroke}
            onUndoDoodle={undoDoodle}
            onClearDoodles={clearDoodles}
            onBackToCamera={() => setStage('ready')}
            onFinishAndPrint={() => setIsPrintModalOpen(true)}
          />
        ) : (
          <CameraBoothView
            room={room}
            userId={userId}
            isHost={isHost}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            videoRef={videoRef}
            isStreaming={isStreaming}
            cameraError={cameraError}
            isMirrored={isMirrored}
            onToggleMirror={toggleMirror}
            onSwitchCamera={switchCamera}
            onCaptureSnapshot={captureSnapshot}
            onFileUpload={handleFileUpload}
            onStartCountdown={startCountdown}
            onSubmitPhoto={submitPhoto}
            onClearSlot={clearSlot}
            onUpdateConfig={updateRoomConfig}
            onProceedToDecor={() => setStage('editing')}
            countdownEvent={countdownEvent}
            onClearCountdown={() => setCountdownEvent(null)}
            peerLiveFrame={peerLiveFrame}
            onBroadcastLiveFrame={broadcastLiveFrame}
            remoteStream={remoteStream}
            onSuggestPose={suggestPose}
          />
        )}
      </main>

      {/* Invite Friends Modal */}
      {isInviteModalOpen && room && (
        <InviteModal
          roomCode={room.code}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}

      {/* Print Keepsake Modal */}
      {isPrintModalOpen && room && (
        <PrintModal
          room={room}
          onClose={() => setIsPrintModalOpen(false)}
          onResetSession={handleResetSession}
        />
      )}

      {/* Real-Time Flying Reactions Overlay */}
      {room && (
        <ReactionsOverlay
          reactions={reactions}
          onSendReaction={sendReaction}
          showBar={true}
        />
      )}
    </div>
  );
}
