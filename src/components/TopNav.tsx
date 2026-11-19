import { useState } from "react";
import { BookOpen, Menu, Upload } from "lucide-react";
import type { AppView, PaperRecord, UserProfile } from "../types/paper";

interface TopNavProps {
  activeView: AppView;
  activePaper: PaperRecord | null;
  userProfile: UserProfile;
  onNavigate: (view: AppView) => void;
  onOpenMobileSidebar: () => void;
  onTriggerUpload: () => void;
  onOpenSettings: () => void;
  isProcessing: boolean;
}

const AVATAR_URL = "/src/assets/images/avatar_researcher_1795098800212.jpg";

export function TopNav({
  activeView,
  activePaper,
  userProfile,
  onNavigate,
  onOpenMobileSidebar,
  onTriggerUpload,
  onOpenSettings,
  isProcessing,
}: TopNavProps) {
  const [avatarError, setAvatarError] = useState(false);

  const initials = userProfile.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E7E2DA] px-4 lg:px-6 flex items-center justify-between gap-4">
      {/* Zone 1: Brand Wordmark + Mobile Menu Trigger */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open document library sidebar"
          className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-[#524C61] hover:bg-[#F4F1EC] hover:text-[#1C1926] transition-colors focus-visible:outline-2 focus-visible:outline-[#4C1D95]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-2.5 text-left group focus-visible:outline-2 focus-visible:outline-[#4C1D95] rounded-lg whitespace-nowrap shrink-0"
        >
          <span className="w-8 h-8 rounded-lg bg-[#4C1D95] text-white flex items-center justify-center shadow-[0_1px_2px_rgba(76,29,149,0.2)]">
            <BookOpen className="w-4 h-4" strokeWidth={2.2} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-[#1C1926] whitespace-nowrap">
            ResearchMate AI
          </span>
        </button>
      </div>

      {/* Zone 2: Clean Single-Line Navigation Links */}
      <nav
        aria-label="Primary workspace navigation"
        className="hidden md:flex items-center gap-7 text-sm font-medium"
      >
        <button
          type="button"
          onClick={() => onNavigate("dashboard")}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeView === "dashboard"
              ? "text-[#4C1D95] border-[#4C1D95]"
              : "text-[#524C61] border-transparent hover:text-[#1C1926]"
          }`}
        >
          Dashboard
        </button>
        <button
          type="button"
          disabled={!activePaper}
          onClick={() => activePaper && onNavigate("workspace")}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeView === "workspace"
              ? "text-[#4C1D95] border-[#4C1D95]"
              : activePaper
              ? "text-[#524C61] border-transparent hover:text-[#1C1926]"
              : "text-[#A7A0B5] border-transparent cursor-not-allowed"
          }`}
        >
          Workspace
        </button>
        <button
          type="button"
          disabled={!activePaper}
          onClick={() => activePaper && onNavigate("summary")}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeView === "summary"
              ? "text-[#4C1D95] border-[#4C1D95]"
              : activePaper
              ? "text-[#524C61] border-transparent hover:text-[#1C1926]"
              : "text-[#A7A0B5] border-transparent cursor-not-allowed"
          }`}
        >
          Summary &amp; Insights
        </button>
      </nav>

      {/* Zone 3: Upload Action & User Profile Area */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onTriggerUpload}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#4C1D95] text-white hover:bg-[#3B157A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1D95]"
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open researcher profile and settings"
          className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-[#F4F1EC] transition-colors focus-visible:outline-2 focus-visible:outline-[#4C1D95] shrink-0"
        >
          {avatarError ? (
            <span className="w-8 h-8 rounded-full bg-[#EDE9FE] text-[#4C1D95] text-xs font-semibold flex items-center justify-center shrink-0">
              {initials || "RM"}
            </span>
          ) : (
            <img
              src={AVATAR_URL}
              alt={`${userProfile.name} profile portrait`}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="w-8 h-8 rounded-full object-cover border border-[#E7E2DA] shrink-0"
            />
          )}
          <div className="hidden xl:flex flex-col items-start text-left leading-tight">
            <span className="text-xs font-semibold text-[#1C1926] max-w-[120px] truncate">
              {userProfile.name}
            </span>
            <span className="text-[11px] text-[#797288] max-w-[120px] truncate">
              {userProfile.role}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}
