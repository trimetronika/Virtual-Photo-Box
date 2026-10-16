import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Types for in-memory room management
interface RoomUser {
  id: string;
  name: string;
  avatarColor: string;
  joinedAt: number;
  ws?: WebSocket;
}

interface StickerItem {
  id: string;
  content: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number;
  rotation: number;
  createdBy: string;
}

interface DoodlePoint {
  x: number;
  y: number;
}

interface DoodleStroke {
  id: string;
  color: string;
  strokeWidth: number;
  points: DoodlePoint[];
  createdBy: string;
}

interface RoomState {
  code: string;
  createdAt: number;
  hostId: string;
  users: RoomUser[];
  templateId: string; // 'classic-4' | 'strip-3' | 'grid-2x2' | 'postcard' | 'polaroid'
  captureMode: 'split' | 'alternate' | 'solo';
  countdownDuration: number; // 3 or 5
  activeSlotIndex: number;
  stage: 'lobby' | 'ready' | 'shooting' | 'countdown' | 'editing' | 'finished';
  slots: {
    slotIndex: number;
    photoDataA?: string; // Base64
    photoDataB?: string; // Base64
    userAName?: string;
    userBName?: string;
  }[];
  decorations: {
    frameColor: string;
    borderPattern: string; // 'solid' | 'checkered' | 'dots' | 'clouds' | 'gradient'
    captionText: string;
    dateStamp: string;
    filter: string;
    stickers: StickerItem[];
    doodles: DoodleStroke[];
  };
}

const rooms = new Map<string, RoomState>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function getSanitizedRoomState(room: RoomState) {
  return {
    code: room.code,
    createdAt: room.createdAt,
    hostId: room.hostId,
    users: room.users.map((u) => ({
      id: u.id,
      name: u.name,
      avatarColor: u.avatarColor,
      joinedAt: u.joinedAt,
    })),
    templateId: room.templateId,
    captureMode: room.captureMode,
    countdownDuration: room.countdownDuration,
    activeSlotIndex: room.activeSlotIndex,
    stage: room.stage,
    slots: room.slots,
    decorations: room.decorations,
  };
}

function broadcastToRoom(room: RoomState, message: object, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  room.users.forEach((user) => {
    if (user.ws && user.ws !== excludeWs && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(data);
    }
  });
}

function createDefaultRoom(code: string, hostUser: RoomUser): RoomState {
  return {
    code,
    createdAt: Date.now(),
    hostId: hostUser.id,
    users: [hostUser],
    templateId: 'classic-4',
    captureMode: 'split',
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
      frameColor: '#FFE4E6', // Soft blush pink
      borderPattern: 'solid',
      captionText: '인생네컷 · Our Memories',
      dateStamp: new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).replace(/\. /g, '.').replace(/\.$/, ''),
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

wss.on('connection', (ws: WebSocket) => {
  let currentUser: RoomUser | null = null;
  let currentRoomCode: string | null = null;

  ws.on('message', (rawMessage: string) => {
    try {
      const msg = JSON.parse(rawMessage.toString());
      const { type, payload } = msg;

      switch (type) {
        case 'room:create': {
          const code = generateRoomCode();
          currentUser = {
            id: payload.userId || Math.random().toString(36).substring(2, 9),
            name: payload.userName || 'Chingu 1',
            avatarColor: payload.avatarColor || '#F43F5E',
            joinedAt: Date.now(),
            ws,
          };
          const newRoom = createDefaultRoom(code, currentUser);
          if (payload.captureMode) newRoom.captureMode = payload.captureMode;
          rooms.set(code, newRoom);
          currentRoomCode = code;

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              payload: {
                room: getSanitizedRoomState(newRoom),
                userId: currentUser.id,
                isHost: true,
              },
            })
          );
          break;
        }

        case 'room:join': {
          const code = (payload.code || '').trim().toUpperCase();
          const room = rooms.get(code);

          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: `Room "${code}" tidak ditemukan.` },
              })
            );
            return;
          }

          currentUser = {
            id: payload.userId || Math.random().toString(36).substring(2, 9),
            name: payload.userName || `Chingu ${room.users.length + 1}`,
            avatarColor: payload.avatarColor || '#3B82F6',
            joinedAt: Date.now(),
            ws,
          };

          // If reconnecting with same id, replace ws
          const existingIdx = room.users.findIndex((u) => u.id === currentUser?.id);
          if (existingIdx !== -1) {
            room.users[existingIdx].ws = ws;
            room.users[existingIdx].name = currentUser.name;
          } else {
            room.users.push(currentUser);
          }
          currentRoomCode = code;

          ws.send(
            JSON.stringify({
              type: 'room:joined',
              payload: {
                room: getSanitizedRoomState(room),
                userId: currentUser.id,
                isHost: room.hostId === currentUser.id,
              },
            })
          );

          broadcastToRoom(
            room,
            {
              type: 'room:user_joined',
              payload: {
                user: {
                  id: currentUser.id,
                  name: currentUser.name,
                  avatarColor: currentUser.avatarColor,
                },
                room: getSanitizedRoomState(room),
              },
            },
            ws
          );
          break;
        }

        case 'room:update_config': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          if (payload.templateId) room.templateId = payload.templateId;
          if (payload.captureMode) room.captureMode = payload.captureMode;
          if (payload.countdownDuration) room.countdownDuration = payload.countdownDuration;
          if (typeof payload.slotCount === 'number') {
            room.slots = Array.from({ length: payload.slotCount }, (_, i) => ({
              ...(room.slots[i] || {}),
              slotIndex: i,
            }));
          }

          broadcastToRoom(room, {
            type: 'room:config_updated',
            payload: { room: getSanitizedRoomState(room) },
          });
          break;
        }

        case 'stage:set': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          room.stage = payload.stage;
          if (payload.activeSlotIndex !== undefined) {
            room.activeSlotIndex = payload.activeSlotIndex;
          }

          broadcastToRoom(room, {
            type: 'stage:updated',
            payload: {
              stage: room.stage,
              activeSlotIndex: room.activeSlotIndex,
              room: getSanitizedRoomState(room),
            },
          });
          break;
        }

        case 'shoot:start_countdown': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const slotIndex = payload.slotIndex ?? room.activeSlotIndex;
          room.activeSlotIndex = slotIndex;
          room.stage = 'countdown';

          const targetTimestamp = Date.now() + (room.countdownDuration * 1000);

          broadcastToRoom(room, {
            type: 'shoot:countdown_started',
            payload: {
              slotIndex,
              duration: room.countdownDuration,
              targetTimestamp,
            },
          });
          break;
        }

        case 'shoot:submit_photo': {
          if (!currentRoomCode || !currentUser) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const { slotIndex, photoData, userRole } = payload;
          if (slotIndex < 0 || slotIndex >= room.slots.length) return;

          if (!room.slots[slotIndex]) {
            room.slots[slotIndex] = { slotIndex };
          }

          if (userRole === 'userB' || room.users[1]?.id === currentUser.id) {
            room.slots[slotIndex].photoDataB = photoData;
            room.slots[slotIndex].userBName = currentUser.name;
          } else {
            room.slots[slotIndex].photoDataA = photoData;
            room.slots[slotIndex].userAName = currentUser.name;
          }

          broadcastToRoom(room, {
            type: 'shoot:photo_submitted',
            payload: {
              slotIndex,
              slot: room.slots[slotIndex],
              submittedBy: currentUser.id,
            },
          });
          break;
        }

        case 'shoot:clear_slot': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const { slotIndex } = payload;
          if (room.slots[slotIndex]) {
            room.slots[slotIndex] = { slotIndex };
          }

          broadcastToRoom(room, {
            type: 'shoot:slot_cleared',
            payload: { slotIndex, room: getSanitizedRoomState(room) },
          });
          break;
        }

        case 'decor:update_frame': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          room.decorations = {
            ...room.decorations,
            ...payload,
          };

          broadcastToRoom(
            room,
            {
              type: 'decor:frame_updated',
              payload: { decorations: room.decorations },
            },
            ws
          );
          break;
        }

        case 'decor:add_sticker': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const sticker = {
            ...payload.sticker,
            id: payload.sticker.id || Math.random().toString(36).substring(2, 9),
            createdBy: currentUser?.id,
          };

          room.decorations.stickers.push(sticker);

          broadcastToRoom(room, {
            type: 'decor:sticker_added',
            payload: { sticker },
          });
          break;
        }

        case 'decor:update_sticker': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const idx = room.decorations.stickers.findIndex((s) => s.id === payload.sticker.id);
          if (idx !== -1) {
            room.decorations.stickers[idx] = {
              ...room.decorations.stickers[idx],
              ...payload.sticker,
            };

            broadcastToRoom(
              room,
              {
                type: 'decor:sticker_updated',
                payload: { sticker: room.decorations.stickers[idx] },
              },
              ws
            );
          }
          break;
        }

        case 'decor:remove_sticker': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          room.decorations.stickers = room.decorations.stickers.filter(
            (s) => s.id !== payload.stickerId
          );

          broadcastToRoom(room, {
            type: 'decor:sticker_removed',
            payload: { stickerId: payload.stickerId },
          });
          break;
        }

        case 'decor:add_doodle': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const stroke: DoodleStroke = {
            ...payload.stroke,
            id: payload.stroke.id || Math.random().toString(36).substring(2, 9),
            createdBy: currentUser?.id || 'anon',
          };

          room.decorations.doodles.push(stroke);

          broadcastToRoom(
            room,
            {
              type: 'decor:doodle_added',
              payload: { stroke },
            },
            ws
          );
          break;
        }

        case 'decor:undo_doodle': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const lastStroke = room.decorations.doodles.pop();
          broadcastToRoom(room, {
            type: 'decor:doodle_undone',
            payload: { strokeId: lastStroke?.id },
          });
          break;
        }

        case 'decor:clear_doodles': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          room.decorations.doodles = [];
          broadcastToRoom(room, {
            type: 'decor:doodles_cleared',
            payload: {},
          });
          break;
        }

        case 'chat:reaction': {
          if (!currentRoomCode || !currentUser) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          broadcastToRoom(room, {
            type: 'chat:reaction_received',
            payload: {
              emoji: payload.emoji,
              userName: currentUser.name,
              userId: currentUser.id,
              timestamp: Date.now(),
            },
          });
          break;
        }

        case 'peer:live_frame': {
          // Low-fps preview thumbnail transmission to partner
          if (!currentRoomCode || !currentUser) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          broadcastToRoom(
            room,
            {
              type: 'peer:live_frame_received',
              payload: {
                userId: currentUser.id,
                thumbnail: payload.thumbnail,
              },
            },
            ws
          );
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoomCode && currentUser) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.users = room.users.filter((u) => u.id !== currentUser?.id);
        if (room.users.length === 0) {
          // Keep room alive for 10 minutes in case of refresh
          setTimeout(() => {
            const r = rooms.get(currentRoomCode!);
            if (r && r.users.length === 0) {
              rooms.delete(currentRoomCode!);
            }
          }, 10 * 60 * 1000);
        } else {
          // If host left, elect next user
          if (room.hostId === currentUser.id && room.users[0]) {
            room.hostId = room.users[0].id;
          }
          broadcastToRoom(room, {
            type: 'room:user_left',
            payload: {
              userId: currentUser.id,
              userName: currentUser.name,
              room: getSanitizedRoomState(room),
            },
          });
        }
      }
    }
  });
});

app.use(express.json({ limit: '15mb' }));

// Health and API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

app.get('/room/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  res.redirect(`/?room=${code}`);
});

app.get('/api/app-info', (req, res) => {
  res.json({
    appUrl: process.env.APP_URL || '',
    activeRooms: rooms.size,
  });
});

app.get('/api/room/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  return res.json(getSanitizedRoomState(room));
});

// Setup Vite middlewares for development or serve dist for production
async function setupVite() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`K-Photobox server running on http://localhost:${PORT}`);
  });
}

setupVite();
