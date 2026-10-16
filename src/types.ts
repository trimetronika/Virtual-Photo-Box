export type CaptureMode = 'split' | 'alternate' | 'solo';
export type Stage = 'lobby' | 'ready' | 'countdown' | 'editing' | 'finished';

export interface RoomUser {
  id: string;
  name: string;
  avatarColor: string;
  joinedAt: number;
}

export interface StickerItem {
  id: string;
  content: string; // text or emoji
  type?: 'emoji' | 'stamp' | 'text';
  x: number; // percentage 0-100 relative to strip
  y: number; // percentage 0-100 relative to strip
  scale: number;
  rotation: number; // degrees
  createdBy: string;
}

export interface DoodlePoint {
  x: number;
  y: number;
}

export interface DoodleStroke {
  id: string;
  color: string;
  strokeWidth: number;
  points: DoodlePoint[];
  createdBy: string;
}

export interface PhotoSlot {
  slotIndex: number;
  photoDataA?: string; // Base64
  photoDataB?: string; // Base64
  userAName?: string;
  userBName?: string;
  compositeData?: string; // Precomputed merged frame
}

export interface FrameDecorations {
  frameColor: string;
  borderPattern: 'solid' | 'checkered' | 'dots' | 'clouds' | 'gradient';
  captionText: string;
  dateStamp: string;
  filter: string;
  stickers: StickerItem[];
  doodles: DoodleStroke[];
}

export interface RoomState {
  code: string;
  createdAt: number;
  hostId: string;
  users: RoomUser[];
  templateId: 'classic-4' | 'strip-3' | 'grid-2x2' | 'postcard' | 'polaroid';
  captureMode: CaptureMode;
  countdownDuration: number;
  activeSlotIndex: number;
  stage: Stage;
  slots: PhotoSlot[];
  decorations: FrameDecorations;
  activePoseId?: string;
}

export interface TemplateConfig {
  id: 'classic-4' | 'strip-3' | 'grid-2x2' | 'postcard' | 'polaroid';
  name: string;
  subtitle: string;
  koreanName: string;
  slotCount: number;
  aspectRatio: string; // e.g. "1 / 3" or "1 / 1"
  widthPx: number;
  heightPx: number;
  slotAspect: number; // width / height of individual photo slot
  layoutType: 'vertical' | 'grid' | 'postcard' | 'polaroid';
}

export interface FilterPreset {
  id: string;
  name: string;
  koreanName: string;
  cssFilter: string;
  description: string;
}

export interface FrameColorPreset {
  id: string;
  name: string;
  hex: string;
  textColor: string;
  category: 'pastel' | 'monochrome' | 'vibrant';
}

export interface ReactionItem {
  id: string;
  emoji: string;
  userName: string;
  timestamp: number;
}

export interface PoseSuggestion {
  id: string;
  category: 'bestie' | 'couple' | 'cute' | 'funny' | 'y2k';
  categoryLabel: string;
  title: string;
  koreanTitle: string;
  description: string;
  instructionA: string;
  instructionB: string;
  emoji: string;
  poseIcon: string;
}

export interface KoreanThemePreset {
  id: string;
  name: string;
  koreanName: string;
  frameColor: string;
  textColor: string;
  borderPattern: 'solid' | 'checkered' | 'dots' | 'clouds' | 'gradient';
  filter: string;
  captionText: string;
  description: string;
}
