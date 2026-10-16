import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Shuffle,
  Heart,
  Users,
  Smile,
  Zap,
  Camera,
  ChevronRight,
  Info,
} from 'lucide-react';
import { PoseSuggestion } from '../types';
import { POSE_SUGGESTIONS, getRandomPose, getPoseById } from '../utils/poseSuggestions';

interface PoseGuideBarProps {
  activePoseId?: string;
  onSelectPose: (poseId: string) => void;
  userRole: 'userA' | 'userB';
  userName: string;
  partnerName?: string;
  isMultiUser: boolean;
  captureMode: 'split' | 'alternate' | 'solo';
}

export const PoseGuideBar: React.FC<PoseGuideBarProps> = ({
  activePoseId,
  onSelectPose,
  userRole,
  userName,
  partnerName = 'Partner',
  isMultiUser,
  captureMode,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Default to first pose or active pose
  const currentPose: PoseSuggestion = useMemo(() => {
    if (activePoseId) {
      return getPoseById(activePoseId);
    }
    return POSE_SUGGESTIONS[0];
  }, [activePoseId]);

  const categories = [
    { id: 'all', label: 'Semua', icon: Sparkles },
    { id: 'bestie', label: 'Bestie', icon: Users },
    { id: 'couple', label: 'Couple', icon: Heart },
    { id: 'cute', label: 'Cute', icon: Smile },
    { id: 'funny', label: 'Lucu', icon: Zap },
    { id: 'y2k', label: 'Y2K', icon: Camera },
  ];

  const filteredPoses = useMemo(() => {
    if (selectedCategory === 'all') return POSE_SUGGESTIONS;
    return POSE_SUGGESTIONS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  const handleShuffle = () => {
    const nextPose = getRandomPose(currentPose.id);
    onSelectPose(nextPose.id);
  };

  // Determine local and partner instructions
  const myInstruction =
    userRole === 'userA' ? currentPose.instructionA : currentPose.instructionB;
  const partnerInstruction =
    userRole === 'userA' ? currentPose.instructionB : currentPose.instructionA;

  return (
    <div className="bg-white rounded-2xl border border-[#F1ECE7] shadow-xs overflow-hidden transition-all">
      {/* Top Bar: Title & Shuffle Action */}
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-rose-50/70 via-[#FFF9F5] to-indigo-50/60 border-b border-[#F1ECE7] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center text-xs font-bold">
            ✨
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 tracking-tight">
                Panduan Pose K-Photobox
              </span>
              <span className="text-[10px] text-rose-500 font-medium">
                포즈 가이드
              </span>
            </div>
            <p className="text-[10px] text-slate-500 leading-none">
              Inspirasi pose estetik ala studio Korea
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShuffle}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
            title="Ganti ide pose acak"
          >
            <Shuffle className="w-3 h-3" />
            <span>Acak Pose</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 text-[10px] font-medium transition-colors cursor-pointer"
            title={isExpanded ? 'Tutup daftar pose' : 'Lihat semua ide pose'}
          >
            <ChevronRight
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Active Pose Card */}
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          {/* Pose Icon / Emoji */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-indigo-100 border border-white flex items-center justify-center text-2xl shadow-xs shrink-0 select-none">
            {currentPose.emoji}
          </div>

          {/* Pose Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-xs font-bold text-slate-900 truncate">
                {currentPose.title}
              </h4>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 font-medium">
                {currentPose.koreanTitle}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase font-semibold">
                {currentPose.categoryLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 line-clamp-1 mb-2">
              {currentPose.description}
            </p>

            {/* Instruction Badges */}
            {isMultiUser && captureMode !== 'solo' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {/* My Instruction */}
                <div className="p-2 rounded-lg bg-rose-50/80 border border-rose-200/60">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                      <span>Kamu ({userName})</span>
                      <span className="text-[8px] bg-rose-500 text-white px-1 py-0.2 rounded">
                        Gayamu
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-800 font-medium leading-tight">
                    {myInstruction}
                  </p>
                </div>

                {/* Partner Instruction */}
                <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-200/50">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold text-indigo-700">
                      {partnerName}
                    </span>
                    <span className="text-[9px] text-indigo-500">Pasangan</span>
                  </div>
                  <p className="text-[11px] text-slate-700 font-normal leading-tight">
                    {partnerInstruction}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-rose-50/70 border border-rose-200/60">
                <span className="text-[10px] font-bold text-rose-700 block mb-0.5">
                  Tips Pose:
                </span>
                <p className="text-[11px] text-slate-800 font-medium leading-tight">
                  {currentPose.instructionA}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Pose Browser */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-[#F1ECE7] space-y-2.5">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Pose Quick Select Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {filteredPoses.map((p) => {
                const isCurrent = p.id === currentPose.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPose(p.id)}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      isCurrent
                        ? 'border-rose-400 bg-rose-50/80 ring-1 ring-rose-300 font-bold'
                        : 'border-[#F1ECE7] hover:border-rose-200 bg-white text-slate-700'
                    }`}
                  >
                    <span className="text-base select-none">{p.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold truncate leading-tight">
                        {p.title}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate leading-none">
                        {p.koreanTitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
