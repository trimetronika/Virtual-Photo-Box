import { useCallback, useEffect, useRef, useState } from 'react';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import {
  CaptureMode,
  DoodleStroke,
  FrameDecorations,
  PhotoSlot,
  ReactionItem,
  RoomState,
  RoomUser,
  Stage,
  StickerItem,
} from '../types';
import { sounds } from '../utils/audio';

interface CountdownEvent {
  slotIndex: number;
  duration: number;
  targetTimestamp: number;
}

function getHostPeerId(code: string): string {
  return `kpb-${code.trim().toLowerCase()}`;
}

function createInitialRoomState(
  code: string,
  hostUser: RoomUser,
  captureMode: CaptureMode = 'split'
): RoomState {
  return {
    code: code.toUpperCase(),
    createdAt: Date.now(),
    hostId: hostUser.id,
    users: [hostUser],
    templateId: 'classic-4',
    captureMode,
    countdownDuration: 3,
    activeSlotIndex: 0,
    stage: 'ready',
    slots: [
      { slotIndex: 0 },
      { slotIndex: 1 },
      { slotIndex: 2 },
      { slotIndex: 3 },
    ],
    decorations: {
      frameColor: '#FFE4E6',
      borderPattern: 'solid',
      captionText: '인생네컷 · Our Memories',
      dateStamp: new Date()
        .toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .replace(/\. /g, '.')
        .replace(/\.$/, ''),
      filter: 'vintage-warm',
      stickers: [
        {
          id: 'default-stamp',
          content: '인생네컷',
          x: 50,
          y: 95,
          scale: 1,
          rotation: 0,
          createdBy: hostUser.id,
        },
      ],
      doodles: [],
    },
  };
}

export function usePhotoboxSocket(localStream?: MediaStream | null) {
  const [userId] = useState<string>(() => {
    const saved = localStorage.getItem('kbox_user_id');
    if (saved) return saved;
    const generated = 'user_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem('kbox_user_id', generated);
    return generated;
  });

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('kbox_user_name') || '';
  });

  const [isHost, setIsHost] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [peerLiveFrame, setPeerLiveFrame] = useState<{
    userId: string;
    thumbnail: string;
  } | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [countdownEvent, setCountdownEvent] = useState<CountdownEvent | null>(null);

  // References
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const hostConnectionRef = useRef<DataConnection | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream || null);
  const lastJoinedRoomRef = useRef<{ code: string; name: string } | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkBuffersRef = useRef<
    Map<string, { received: number; total: number; chunks: string[] }>
  >(new Map());

  // 16KB safe chunk size for standard WebRTC SCTP data channels
  const CHUNK_SIZE = 16384;

  const sendReliable = useCallback((conn: DataConnection, msg: object) => {
    if (!conn.open) return;
    try {
      const str = JSON.stringify(msg);
      if (str.length <= CHUNK_SIZE) {
        conn.send(msg);
        return;
      }
      const transferId = 'tr_' + Math.random().toString(36).substring(2, 9);
      const total = Math.ceil(str.length / CHUNK_SIZE);
      for (let i = 0; i < total; i++) {
        const chunk = str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        conn.send({
          __chunk: true,
          transferId,
          index: i,
          total,
          data: chunk,
        });
      }
    } catch (e) {
      console.warn('sendReliable error:', e);
    }
  }, []);

  useEffect(() => {
    localStreamRef.current = localStream || null;

    // If active WebRTC call exists and stream changed, update video track without re-calling
    if (localStream && callRef.current?.peerConnection) {
      try {
        const senders = callRef.current.peerConnection.getSenders();
        const vTrack = localStream.getVideoTracks()[0];
        const vSender = senders.find((s) => s.track?.kind === 'video');
        if (vSender && vTrack) {
          vSender.replaceTrack(vTrack).catch(() => {});
        }
      } catch (err) {
        console.warn('Track replacement notice:', err);
      }
    }
  }, [localStream]);

  // Host broadcasts message to all connected peers (can exclude sender)
  const broadcastToPeers = useCallback(
    (msg: object, excludePeerId?: string) => {
      connectionsRef.current.forEach((conn) => {
        if (conn.open && (!excludePeerId || conn.peer !== excludePeerId)) {
          sendReliable(conn, msg);
        }
      });
    },
    [sendReliable]
  );

  // Guest sends message to Host
  const sendToHostOrSelf = useCallback(
    (type: string, payload: unknown) => {
      if (hostConnectionRef.current && hostConnectionRef.current.open) {
        sendReliable(hostConnectionRef.current, { type, payload });
      }
    },
    [sendReliable]
  );

  // Call peer for WebRTC live video (Only Guest initiates call to Host to avoid glare conflicts)
  const callHostWithStream = useCallback((targetPeerId: string) => {
    if (!peerRef.current || !localStreamRef.current) return;
    if (callRef.current) return; // Prevent duplicate concurrent calls

    try {
      const call = peerRef.current.call(targetPeerId, localStreamRef.current);
      callRef.current = call;
      call.on('stream', (stream) => {
        setRemoteStream(stream);
      });
      call.on('close', () => {
        callRef.current = null;
        setRemoteStream(null);
      });
      call.on('error', (err) => {
        console.warn('WebRTC Call error:', err);
      });
    } catch (e) {
      console.warn('Failed to call host:', e);
    }
  }, []);

  // When guest has localStream and host connection is open, initiate single call if not started
  useEffect(() => {
    if (!localStream) return;
    if (!isHost && hostConnectionRef.current && hostConnectionRef.current.open && !callRef.current) {
      callHostWithStream(hostConnectionRef.current.peer);
    }
  }, [localStream, isHost, callHostWithStream]);

  // Central incoming message dispatcher (handles messages on Host and Guest)
  const handleIncomingMessage = useCallback(
    (msg: { type: string; payload: any }, fromConn?: DataConnection) => {
      const { type, payload } = msg;

      switch (type) {
        // --- ROOM MANAGEMENT ---
        case 'room:join_request': {
          // Received by Host when a guest wants to join
          const newGuest: RoomUser = {
            id: payload.userId,
            name: payload.userName,
            avatarColor: payload.avatarColor || '#3B82F6',
            joinedAt: Date.now(),
          };

          setRoom((prev) => {
            if (!prev) return null;
            const updatedUsers = [
              ...prev.users.filter((u) => u.id !== newGuest.id),
              newGuest,
            ];
            const updatedRoom: RoomState = { ...prev, users: updatedUsers };

            // Send full room state back to the guest
            if (fromConn && fromConn.open) {
              sendReliable(fromConn, {
                type: 'room:joined',
                payload: {
                  room: updatedRoom,
                  userId: newGuest.id,
                  isHost: false,
                },
              });
            }

            // Broadcast to other peers
            broadcastToPeers(
              {
                type: 'room:user_joined',
                payload: { user: newGuest, room: updatedRoom },
              },
              fromConn?.peer
            );

            return updatedRoom;
          });
          break;
        }

        case 'room:joined': {
          // Received by Guest from Host
          setRoom(payload.room);
          setIsHost(payload.isHost);
          setError(null);
          setIsReconnecting(false);
          setReconnectAttempt(0);
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          break;
        }

        case 'room:user_joined': {
          setRoom(payload.room);
          break;
        }

        case 'room:user_left': {
          setRoom(payload.room);
          break;
        }

        case 'room:update_config': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const updated: RoomState = {
              ...prev,
              templateId: payload.templateId || prev.templateId,
              captureMode: payload.captureMode || prev.captureMode,
              countdownDuration:
                payload.countdownDuration || prev.countdownDuration,
              slots:
                typeof payload.slotCount === 'number'
                  ? Array.from({ length: payload.slotCount }, (_, i) => ({
                      ...(prev.slots[i] || {}),
                      slotIndex: i,
                    }))
                  : prev.slots,
            };
            broadcastToPeers({
              type: 'room:config_updated',
              payload: { room: updated },
            });
            return updated;
          });
          break;
        }

        case 'room:config_updated': {
          // Received by Guest from Host
          setRoom(payload.room);
          break;
        }

        case 'stage:set': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const updated: RoomState = {
              ...prev,
              stage: payload.stage,
              activeSlotIndex:
                payload.activeSlotIndex !== undefined
                  ? payload.activeSlotIndex
                  : prev.activeSlotIndex,
            };
            broadcastToPeers({
              type: 'stage:updated',
              payload: { room: updated },
            });
            return updated;
          });
          break;
        }

        case 'stage:updated': {
          // Received by Guest from Host
          setRoom(payload.room);
          break;
        }

        // --- LIVE VIDEO / THUMBNAILS ---
        case 'peer:live_frame': {
          // Received by Host from Guest
          if (payload && payload.userId !== userId) {
            setPeerLiveFrame(payload);
          }
          // Relay to other peers if any, EXCLUDING sender
          if (fromConn) {
            broadcastToPeers(
              {
                type: 'peer:live_frame_received',
                payload,
              },
              fromConn.peer
            );
          }
          break;
        }

        case 'peer:live_frame_received': {
          // Received by Guest from Host
          if (payload && payload.userId !== userId) {
            setPeerLiveFrame(payload);
          }
          break;
        }

        // --- COUNTDOWN & SHUTTER ---
        case 'shoot:start_countdown': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const duration = prev.countdownDuration || 3;
            const targetTimestamp = Date.now() + duration * 1000;
            const eventData = {
              slotIndex: payload.slotIndex,
              duration,
              targetTimestamp,
            };
            setCountdownEvent(eventData);
            broadcastToPeers({
              type: 'shoot:countdown_started',
              payload: eventData,
            });
            return {
              ...prev,
              activeSlotIndex: payload.slotIndex,
              stage: 'countdown',
            };
          });
          break;
        }

        case 'shoot:countdown_started': {
          // Received by Guest from Host
          setCountdownEvent({
            slotIndex: payload.slotIndex,
            duration: payload.duration,
            targetTimestamp: payload.targetTimestamp,
          });
          break;
        }

        // --- PHOTO SNAPSHOT SUBMISSION & MERGING ---
        case 'shoot:submit_photo': {
          // Received by Host from Guest
          const { slotIndex, photoData, userRole, senderName } = payload;
          setRoom((prev) => {
            if (!prev) return null;
            const newSlots = [...prev.slots];
            const existingSlot = newSlots[slotIndex] || { slotIndex };

            const updatedSlot: PhotoSlot = {
              ...existingSlot,
              slotIndex,
              ...(userRole === 'userB'
                ? {
                    photoDataB: photoData,
                    userBName: senderName || 'Partner',
                  }
                : {
                    photoDataA: photoData,
                    userAName: senderName || 'Host',
                  }),
            };

            newSlots[slotIndex] = updatedSlot;
            const updatedRoom = { ...prev, slots: newSlots };

            // Host broadcasts merged slot to all guests
            broadcastToPeers({
              type: 'shoot:photo_submitted',
              payload: { slotIndex, slot: updatedSlot },
            });

            return updatedRoom;
          });
          break;
        }

        case 'shoot:photo_submitted': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            const newSlots = [...prev.slots];
            const currentSlot = newSlots[payload.slotIndex] || {
              slotIndex: payload.slotIndex,
            };
            newSlots[payload.slotIndex] = {
              ...currentSlot,
              ...payload.slot,
              photoDataA: payload.slot.photoDataA || currentSlot.photoDataA,
              userAName: payload.slot.userAName || currentSlot.userAName,
              photoDataB: payload.slot.photoDataB || currentSlot.photoDataB,
              userBName: payload.slot.userBName || currentSlot.userBName,
            };
            return { ...prev, slots: newSlots };
          });
          break;
        }

        case 'shoot:clear_slot': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const newSlots = [...prev.slots];
            newSlots[payload.slotIndex] = { slotIndex: payload.slotIndex };
            const updated = { ...prev, slots: newSlots };
            broadcastToPeers({
              type: 'shoot:slot_cleared',
              payload: { room: updated },
            });
            return updated;
          });
          break;
        }

        case 'shoot:slot_cleared': {
          // Received by Guest from Host
          setRoom(payload.room);
          break;
        }

        // --- DECORATIONS: FRAMES, STICKERS, DOODLES ---
        case 'decor:update_frame': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const updated = {
              ...prev,
              decorations: { ...prev.decorations, ...payload.decorations },
            };
            broadcastToPeers({
              type: 'decor:frame_updated',
              payload: { decorations: updated.decorations },
            });
            return updated;
          });
          break;
        }

        case 'decor:frame_updated': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            return { ...prev, decorations: payload.decorations };
          });
          break;
        }

        case 'decor:add_sticker': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            if (
              prev.decorations.stickers.some(
                (s) => s.id === payload.sticker.id
              )
            )
              return prev;
            const updated = {
              ...prev,
              decorations: {
                ...prev.decorations,
                stickers: [...prev.decorations.stickers, payload.sticker],
              },
            };
            broadcastToPeers({
              type: 'decor:sticker_added',
              payload: { sticker: payload.sticker },
            });
            return updated;
          });
          break;
        }

        case 'decor:sticker_added': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            if (
              prev.decorations.stickers.some(
                (s) => s.id === payload.sticker.id
              )
            )
              return prev;
            return {
              ...prev,
              decorations: {
                ...prev.decorations,
                stickers: [...prev.decorations.stickers, payload.sticker],
              },
            };
          });
          break;
        }

        case 'decor:update_sticker': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const updatedStickers = prev.decorations.stickers.map((s) =>
              s.id === payload.sticker.id ? { ...s, ...payload.sticker } : s
            );
            const updated = {
              ...prev,
              decorations: { ...prev.decorations, stickers: updatedStickers },
            };
            broadcastToPeers({
              type: 'decor:sticker_updated',
              payload: { sticker: payload.sticker },
            });
            return updated;
          });
          break;
        }

        case 'decor:sticker_updated': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            const updatedStickers = prev.decorations.stickers.map((s) =>
              s.id === payload.sticker.id ? { ...s, ...payload.sticker } : s
            );
            return {
              ...prev,
              decorations: { ...prev.decorations, stickers: updatedStickers },
            };
          });
          break;
        }

        case 'decor:remove_sticker': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const updated = {
              ...prev,
              decorations: {
                ...prev.decorations,
                stickers: prev.decorations.stickers.filter(
                  (s) => s.id !== payload.stickerId
                ),
              },
            };
            broadcastToPeers({
              type: 'decor:sticker_removed',
              payload: { stickerId: payload.stickerId },
            });
            return updated;
          });
          break;
        }

        case 'decor:sticker_removed': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              decorations: {
                ...prev.decorations,
                stickers: prev.decorations.stickers.filter(
                  (s) => s.id !== payload.stickerId
                ),
              },
            };
          });
          break;
        }

        case 'decor:add_doodle': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            if (
              prev.decorations.doodles.some((d) => d.id === payload.stroke.id)
            )
              return prev;
            const updated = {
              ...prev,
              decorations: {
                ...prev.decorations,
                doodles: [...prev.decorations.doodles, payload.stroke],
              },
            };
            broadcastToPeers({
              type: 'decor:doodle_added',
              payload: { stroke: payload.stroke },
            });
            return updated;
          });
          break;
        }

        case 'decor:doodle_added': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            if (
              prev.decorations.doodles.some((d) => d.id === payload.stroke.id)
            )
              return prev;
            return {
              ...prev,
              decorations: {
                ...prev.decorations,
                doodles: [...prev.decorations.doodles, payload.stroke],
              },
            };
          });
          break;
        }

        case 'decor:undo_doodle': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const newDoodles = [...prev.decorations.doodles];
            newDoodles.pop();
            const updated = {
              ...prev,
              decorations: { ...prev.decorations, doodles: newDoodles },
            };
            broadcastToPeers({ type: 'decor:doodle_undone', payload: {} });
            return updated;
          });
          break;
        }

        case 'decor:doodle_undone': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            const newDoodles = [...prev.decorations.doodles];
            newDoodles.pop();
            return {
              ...prev,
              decorations: { ...prev.decorations, doodles: newDoodles },
            };
          });
          break;
        }

        case 'decor:clear_doodles': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const updated = {
              ...prev,
              decorations: { ...prev.decorations, doodles: [] },
            };
            broadcastToPeers({ type: 'decor:doodles_cleared', payload: {} });
            return updated;
          });
          break;
        }

        case 'decor:doodles_cleared': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              decorations: { ...prev.decorations, doodles: [] },
            };
          });
          break;
        }

        // --- REACTIONS ---
        case 'chat:reaction': {
          // Received by Host from Guest
          const reactionPayload = {
            id: Math.random().toString(),
            emoji: payload.emoji,
            userName: payload.userName,
            timestamp: Date.now(),
          };
          setReactions((prev) => [...prev.slice(-15), reactionPayload]);
          sounds.playFlashChime();
          broadcastToPeers({
            type: 'chat:reaction_received',
            payload: reactionPayload,
          });
          break;
        }

        case 'chat:reaction_received': {
          // Received by Guest from Host
          setReactions((prev) => [
            ...prev.slice(-15),
            {
              id: payload.id || Math.random().toString(),
              emoji: payload.emoji,
              userName: payload.userName,
              timestamp: payload.timestamp,
            },
          ]);
          sounds.playFlashChime();
          break;
        }

        // --- POSE SUGGESTIONS ---
        case 'pose:suggest': {
          // Received by Host from Guest
          setRoom((prev) => {
            if (!prev) return null;
            const updated = { ...prev, activePoseId: payload.poseId };
            broadcastToPeers({
              type: 'pose:suggested',
              payload: { poseId: payload.poseId },
            });
            return updated;
          });
          sounds.playFlashChime();
          break;
        }

        case 'pose:suggested': {
          // Received by Guest from Host
          setRoom((prev) => {
            if (!prev) return null;
            return { ...prev, activePoseId: payload.poseId };
          });
          sounds.playFlashChime();
          break;
        }

        default:
          break;
      }
    },
    [broadcastToPeers, sendReliable, userId]
  );

  // Reassemble incoming chunked messages or dispatch direct message
  const handleIncomingData = useCallback(
    (raw: any, conn: DataConnection) => {
      if (raw && typeof raw === 'object' && raw.__chunk) {
        const { transferId, index, total, data } = raw;
        let entry = chunkBuffersRef.current.get(transferId);
        if (!entry) {
          entry = { received: 0, total, chunks: new Array(total) };
          chunkBuffersRef.current.set(transferId, entry);
        }
        if (!entry.chunks[index]) {
          entry.chunks[index] = data;
          entry.received++;
        }
        if (entry.received === entry.total) {
          chunkBuffersRef.current.delete(transferId);
          try {
            const fullMsg = JSON.parse(entry.chunks.join(''));
            handleIncomingMessage(fullMsg, conn);
          } catch (err) {
            console.warn('Reassembled message parse failed:', err);
          }
        }
        return;
      }
      handleIncomingMessage(raw, conn);
    },
    [handleIncomingMessage]
  );

  // CREATE ROOM AS HOST
  const createRoom = useCallback(
    (name: string, captureMode: CaptureMode = 'split') => {
      setError(null);
      localStorage.setItem('kbox_user_name', name);
      setUserName(name);

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      // Generate 6-char room code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const hostUser: RoomUser = {
        id: userId,
        name,
        avatarColor: '#F43F5E',
        joinedAt: Date.now(),
      };

      const newRoom = createInitialRoomState(code, hostUser, captureMode);
      setRoom(newRoom);
      setIsHost(true);

      const hostPeerId = getHostPeerId(code);
      try {
        const peer = new Peer(hostPeerId, {
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
              { urls: 'stun:stun.services.mozilla.com' },
            ],
          },
        });

        peerRef.current = peer;

        // Listen for incoming guest connections
        peer.on('connection', (conn) => {
          connectionsRef.current = connectionsRef.current.filter(
            (c) => c.open && c.peer !== conn.peer
          );
          connectionsRef.current.push(conn);

          conn.on('data', (data: any) => {
            handleIncomingData(data, conn);
          });

          conn.on('close', () => {
            connectionsRef.current = connectionsRef.current.filter(
              (c) => c !== conn
            );
            setRoom((prev) => {
              if (!prev) return null;
              const remainingUsers = prev.users.filter(
                (u) => u.id === hostUser.id
              );
              const updatedRoom = { ...prev, users: remainingUsers };
              broadcastToPeers({
                type: 'room:user_left',
                payload: { room: updatedRoom },
              });
              return updatedRoom;
            });
            setRemoteStream(null);
            setPeerLiveFrame(null);
          });
        });

        // Listen for incoming video calls from guests (Host answers)
        peer.on('call', (call) => {
          callRef.current = call;
          if (localStreamRef.current) {
            call.answer(localStreamRef.current);
          } else {
            call.answer();
          }
          call.on('stream', (stream) => {
            setRemoteStream(stream);
          });
          call.on('close', () => {
            callRef.current = null;
            setRemoteStream(null);
          });
          call.on('error', (err) => {
            console.warn('Host call error caught:', err);
          });
        });

        peer.on('error', (err: any) => {
          console.warn('Host PeerJS notice:', err);
          if (err.type === 'unavailable-id') {
            setTimeout(() => {
              createRoom(name, captureMode);
            }, 1000);
          }
        });
      } catch (e) {
        console.error('Failed to init host peer:', e);
      }
    },
    [userId, broadcastToPeers, handleIncomingData]
  );

  // JOIN ROOM AS GUEST
  const joinRoom = useCallback(
    (inputCode: string, name: string, isAutoRetry = false) => {
      const code = (inputCode || '').trim().toUpperCase();
      if (!code) return;

      if (!isAutoRetry) {
        setError(null);
        setReconnectAttempt(0);
        setIsReconnecting(false);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      }
      localStorage.setItem('kbox_user_name', name);
      setUserName(name);
      lastJoinedRoomRef.current = { code, name };

      if (peerRef.current) {
        peerRef.current.destroy();
      }

      if (callRef.current) {
        try {
          callRef.current.close();
        } catch {
          // ignore
        }
        callRef.current = null;
      }

      const targetHostPeerId = getHostPeerId(code);

      try {
        const guestPeer = new Peer({
          debug: 0,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' },
              { urls: 'stun:stun.services.mozilla.com' },
            ],
          },
        });

        peerRef.current = guestPeer;

        guestPeer.on('open', () => {
          const conn = guestPeer.connect(targetHostPeerId, {
            reliable: true,
          });
          hostConnectionRef.current = conn;

          conn.on('open', () => {
            sendReliable(conn, {
              type: 'room:join_request',
              payload: {
                userId,
                userName: name,
                avatarColor: '#3B82F6',
                code,
              },
            });

            // Call Host for video stream (single bidirectional call)
            if (localStreamRef.current && !callRef.current) {
              callHostWithStream(targetHostPeerId);
            }
          });

          conn.on('data', (data: any) => {
            handleIncomingData(data, conn);
          });

          conn.on('close', () => {
            setRemoteStream(null);
            setPeerLiveFrame(null);
            if (callRef.current) {
              try {
                callRef.current.close();
              } catch {
                // ignore
              }
              callRef.current = null;
            }

            // If we were connected to a room, trigger reconnection attempt
            if (lastJoinedRoomRef.current) {
              setIsReconnecting(true);
              setReconnectAttempt((prev) => {
                const nextAttempt = prev + 1;
                if (nextAttempt <= 5) {
                  setError(`Koneksi terputus. Mencoba menyambungkan kembali (Percobaan ${nextAttempt}/5)...`);
                  const delay = Math.min(1200 * Math.pow(1.4, nextAttempt - 1), 6000);
                  if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                  reconnectTimerRef.current = setTimeout(() => {
                    if (lastJoinedRoomRef.current) {
                      joinRoom(lastJoinedRoomRef.current.code, lastJoinedRoomRef.current.name, true);
                    }
                  }, delay);
                } else {
                  setIsReconnecting(false);
                  setError(`Koneksi ke room "${code}" terputus. Silakan klik Sambungkan Ulang.`);
                }
                return nextAttempt;
              });
            } else {
              setError(`Koneksi ke room "${code}" terputus.`);
            }
          });

          conn.on('error', () => {
            if (!lastJoinedRoomRef.current) {
              setError(`Tidak dapat terhubung ke room "${code}".`);
            }
          });
        });

        guestPeer.on('error', (err: any) => {
          console.warn('Guest PeerJS notice:', err);
          if (err.type === 'peer-unavailable') {
            setError(
              `Room "${code}" tidak ditemukan. Pastikan Host masih membuka layarnya.`
            );
            setIsReconnecting(false);
          } else {
            setError(
              `Gagal terhubung ke room "${code}". (${err.type || 'error'})`
            );
          }
        });
      } catch (e) {
        console.error('Failed to init guest peer:', e);
        setError(`Gagal menghubungkan ke room "${code}".`);
      }
    },
    [userId, callHostWithStream, handleIncomingData, sendReliable]
  );

  // Manual reconnect trigger
  const reconnect = useCallback(() => {
    if (lastJoinedRoomRef.current) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setError(null);
      setIsReconnecting(true);
      joinRoom(lastJoinedRoomRef.current.code, lastJoinedRoomRef.current.name, false);
    }
  }, [joinRoom]);

  // Auto reconnect when device comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (lastJoinedRoomRef.current && !isHost) {
        reconnect();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isHost, reconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  // Update room config
  const updateRoomConfig = useCallback(
    (
      config: Partial<{
        templateId: string;
        captureMode: CaptureMode;
        countdownDuration: number;
        slotCount: number;
      }>
    ) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updated: RoomState = {
          ...prev,
          templateId: (config.templateId as any) || prev.templateId,
          captureMode: config.captureMode || prev.captureMode,
          countdownDuration:
            config.countdownDuration || prev.countdownDuration,
          slots:
            typeof config.slotCount === 'number'
              ? Array.from({ length: config.slotCount }, (_, i) => ({
                  ...(prev.slots[i] || {}),
                  slotIndex: i,
                }))
              : prev.slots,
        };

        if (isHost) {
          broadcastToPeers({
            type: 'room:config_updated',
            payload: { room: updated },
          });
        } else {
          sendToHostOrSelf('room:update_config', config);
        }
        return updated;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  // Set active stage
  const setStage = useCallback(
    (stage: Stage, activeSlotIndex?: number) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updated: RoomState = {
          ...prev,
          stage,
          activeSlotIndex:
            activeSlotIndex !== undefined
              ? activeSlotIndex
              : prev.activeSlotIndex,
        };

        if (isHost) {
          broadcastToPeers({
            type: 'stage:updated',
            payload: { room: updated },
          });
        } else {
          sendToHostOrSelf('stage:set', { stage, activeSlotIndex });
        }
        return updated;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  // Start synchronized countdown
  const startCountdown = useCallback(
    (slotIndex: number) => {
      setRoom((prev) => {
        if (!prev) return null;
        const duration = prev.countdownDuration || 3;
        const targetTimestamp = Date.now() + duration * 1000;

        const eventData = { slotIndex, duration, targetTimestamp };
        setCountdownEvent(eventData);

        if (isHost) {
          broadcastToPeers({
            type: 'shoot:countdown_started',
            payload: eventData,
          });
        } else {
          sendToHostOrSelf('shoot:start_countdown', { slotIndex });
        }
        return { ...prev, activeSlotIndex: slotIndex, stage: 'countdown' };
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  // Submit photo snapshot for a slot
  const submitPhoto = useCallback(
    (slotIndex: number, photoData: string, userRole: 'userA' | 'userB') => {
      setRoom((prev) => {
        if (!prev) return null;
        const newSlots: PhotoSlot[] = [...prev.slots];
        const existingSlot = newSlots[slotIndex] || { slotIndex };

        const updatedSlot: PhotoSlot = {
          ...existingSlot,
          slotIndex,
          ...(userRole === 'userB'
            ? {
                photoDataB: photoData,
                userBName: userName,
              }
            : {
                photoDataA: photoData,
                userAName: userName,
              }),
        };

        newSlots[slotIndex] = updatedSlot;
        const updatedRoom = { ...prev, slots: newSlots };

        if (isHost) {
          // Host merges immediately and broadcasts to everyone
          broadcastToPeers({
            type: 'shoot:photo_submitted',
            payload: { slotIndex, slot: updatedSlot },
          });
        } else {
          // Guest sends photo to Host to be merged
          sendToHostOrSelf('shoot:submit_photo', {
            slotIndex,
            photoData,
            userRole,
            senderName: userName,
          });
        }

        return updatedRoom;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf, userName]
  );

  // Clear slot for retake
  const clearSlot = useCallback(
    (slotIndex: number) => {
      setRoom((prev) => {
        if (!prev) return null;
        const newSlots = [...prev.slots];
        newSlots[slotIndex] = { slotIndex };
        const updated = { ...prev, slots: newSlots };

        if (isHost) {
          broadcastToPeers({
            type: 'shoot:slot_cleared',
            payload: { room: updated },
          });
        } else {
          sendToHostOrSelf('shoot:clear_slot', { slotIndex });
        }
        return updated;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  // Update frame decorations
  const updateFrameDecorations = useCallback(
    (decorations: Partial<FrameDecorations>) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updatedDecors = { ...prev.decorations, ...decorations };
        const updatedRoom = { ...prev, decorations: updatedDecors };

        if (isHost) {
          broadcastToPeers({
            type: 'decor:frame_updated',
            payload: { decorations: updatedDecors },
          });
        } else {
          sendToHostOrSelf('decor:update_frame', { decorations: updatedDecors });
        }
        return updatedRoom;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  // Add sticker
  const addSticker = useCallback(
    (sticker: Omit<StickerItem, 'id' | 'createdBy'>) => {
      const id = 'stk_' + Math.random().toString(36).substring(2, 9);
      const newSticker: StickerItem = { ...sticker, id, createdBy: userId };

      setRoom((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          decorations: {
            ...prev.decorations,
            stickers: [...prev.decorations.stickers, newSticker],
          },
        };

        if (isHost) {
          broadcastToPeers({
            type: 'decor:sticker_added',
            payload: { sticker: newSticker },
          });
        } else {
          sendToHostOrSelf('decor:add_sticker', { sticker: newSticker });
        }
        return updated;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf, userId]
  );

  // Update sticker position, rotation, scale
  const updateSticker = useCallback(
    (sticker: Partial<StickerItem> & { id: string }) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updatedStickers = prev.decorations.stickers.map((s) =>
          s.id === sticker.id ? { ...s, ...sticker } : s
        );
        const updated = {
          ...prev,
          decorations: { ...prev.decorations, stickers: updatedStickers },
        };

        if (isHost) {
          broadcastToPeers({
            type: 'decor:sticker_updated',
            payload: { sticker },
          });
        } else {
          sendToHostOrSelf('decor:update_sticker', { sticker });
        }
        return updated;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  // Remove sticker
  const removeSticker = useCallback(
    (stickerId: string) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          decorations: {
            ...prev.decorations,
            stickers: prev.decorations.stickers.filter(
              (s) => s.id !== stickerId
            ),
          },
        };

        if (isHost) {
          broadcastToPeers({
            type: 'decor:sticker_removed',
            payload: { stickerId },
          });
        } else {
          sendToHostOrSelf('decor:remove_sticker', { stickerId });
        }
        return updated;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  // Add doodle stroke
  const addDoodleStroke = useCallback(
    (stroke: Omit<DoodleStroke, 'id' | 'createdBy'>) => {
      const id = 'stroke_' + Math.random().toString(36).substring(2, 9);
      const newStroke: DoodleStroke = { ...stroke, id, createdBy: userId };

      setRoom((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          decorations: {
            ...prev.decorations,
            doodles: [...prev.decorations.doodles, newStroke],
          },
        };

        if (isHost) {
          broadcastToPeers({
            type: 'decor:doodle_added',
            payload: { stroke: newStroke },
          });
        } else {
          sendToHostOrSelf('decor:add_doodle', { stroke: newStroke });
        }
        return updated;
      });
    },
    [isHost, broadcastToPeers, sendToHostOrSelf, userId]
  );

  // Undo doodle
  const undoDoodle = useCallback(() => {
    setRoom((prev) => {
      if (!prev) return null;
      const newDoodles = [...prev.decorations.doodles];
      newDoodles.pop();
      const updated = {
        ...prev,
        decorations: { ...prev.decorations, doodles: newDoodles },
      };

      if (isHost) {
        broadcastToPeers({ type: 'decor:doodle_undone', payload: {} });
      } else {
        sendToHostOrSelf('decor:undo_doodle', {});
      }
      return updated;
    });
  }, [isHost, broadcastToPeers, sendToHostOrSelf]);

  // Clear all doodles
  const clearDoodles = useCallback(() => {
    setRoom((prev) => {
      if (!prev) return null;
      const updated = {
        ...prev,
        decorations: { ...prev.decorations, doodles: [] },
      };

      if (isHost) {
        broadcastToPeers({ type: 'decor:doodles_cleared', payload: {} });
      } else {
        sendToHostOrSelf('decor:clear_doodles', {});
      }
      return updated;
    });
  }, [isHost, broadcastToPeers, sendToHostOrSelf]);

  // Send emoji reaction
  const sendReaction = useCallback(
    (emoji: string) => {
      const reactionPayload = {
        id: Math.random().toString(),
        emoji,
        userName,
        timestamp: Date.now(),
      };

      setReactions((prev) => [...prev.slice(-15), reactionPayload]);
      sounds.playFlashChime();

      if (isHost) {
        broadcastToPeers({
          type: 'chat:reaction_received',
          payload: reactionPayload,
        });
      } else {
        sendToHostOrSelf('chat:reaction', { emoji, userName });
      }
    },
    [isHost, broadcastToPeers, sendToHostOrSelf, userName]
  );

  // Broadcast live video thumbnail
  const broadcastLiveFrame = useCallback(
    (thumbnail: string) => {
      const payload = { userId, thumbnail };
      if (isHost) {
        broadcastToPeers({
          type: 'peer:live_frame_received',
          payload,
        });
      } else {
        sendToHostOrSelf('peer:live_frame', payload);
      }
    },
    [isHost, broadcastToPeers, sendToHostOrSelf, userId]
  );

  // Suggest and synchronize a pose inspiration
  const suggestPose = useCallback(
    (poseId: string) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updated = { ...prev, activePoseId: poseId };
        if (isHost) {
          broadcastToPeers({
            type: 'pose:suggested',
            payload: { poseId },
          });
        } else {
          sendToHostOrSelf('pose:suggest', { poseId });
        }
        return updated;
      });
      sounds.playFlashChime();
    },
    [isHost, broadcastToPeers, sendToHostOrSelf]
  );

  return {
    isConnected: !!room,
    isReconnecting,
    reconnectAttempt,
    reconnect,
    userId,
    userName,
    isHost,
    room,
    error,
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
  };
}
