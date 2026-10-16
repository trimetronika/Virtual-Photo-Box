import React from 'react';
import { ReactionItem } from '../types';

interface ReactionsOverlayProps {
  reactions: ReactionItem[];
  onSendReaction: (emoji: string) => void;
  showBar?: boolean;
}

const REACTION_EMOJIS = ['❤️', '✨', '📸', '✌️', '🎀', '🌸', '🧸'];

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({
  reactions,
  onSendReaction,
  showBar = true,
}) => {
  return (
    <>
      {/* Floating Animated Emojis in the Air */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {reactions.slice(-10).map((r) => (
          <div
            key={r.id}
            style={{
              left: `${30 + ((r.timestamp % 40))}vw`,
              bottom: '15vh',
            }}
            className="absolute flex items-center gap-1 animate-[floatUp_3s_ease-out_forwards] pointer-events-none"
          >
            <span className="text-3xl filter drop-shadow-md">{r.emoji}</span>
            <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full font-medium backdrop-blur-xs">
              {r.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Quick Reaction Bottom Floating Bubble Bar */}
      {showBar && (
        <div className="fixed bottom-4 right-4 z-40 bg-white/95 backdrop-blur-md rounded-full shadow-lg border border-[#E7E2D9] px-2.5 sm:px-3 py-1.5 flex items-center gap-1 sm:gap-1.5 max-w-[calc(100vw-2rem)] overflow-x-auto no-scrollbar">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSendReaction(emoji)}
              className="w-8 h-8 rounded-full hover:bg-rose-50 flex items-center justify-center text-lg hover:scale-125 transition-transform cursor-pointer active:scale-95"
              title={`Kirim ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
};
