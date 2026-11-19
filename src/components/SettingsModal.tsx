import { useState } from "react";
import { Trash2, X } from "lucide-react";
import type { PaperRecord, UserProfile, WorkspaceSettings } from "../types/paper";
import { formatFileSize } from "../lib/pdf";

interface SettingsModalProps {
  open: boolean;
  settings: WorkspaceSettings;
  userProfile: UserProfile;
  papers: PaperRecord[];
  onClose: () => void;
  onSaveSettings: (next: WorkspaceSettings) => void;
  onSaveProfile: (next: UserProfile) => void;
  onClearLibrary: () => void;
}

export function SettingsModal({
  open,
  settings,
  userProfile,
  papers,
  onClose,
  onSaveSettings,
  onSaveProfile,
  onClearLibrary,
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<WorkspaceSettings>(settings);
  const [localProfile, setLocalProfile] = useState<UserProfile>(userProfile);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!open) return null;

  const totalBytes = papers.reduce((sum, p) => sum + (p.fileSize || 0), 0);

  const handleSave = () => {
    onSaveSettings(localSettings);
    onSaveProfile({
      name: localProfile.name.trim() || "Researcher",
      role: localProfile.role.trim() || "Academic Researcher",
      institution: localProfile.institution.trim(),
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#1C1926]/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg bg-[#FFFFFF] rounded-2xl border border-[#E7E2DA] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#E7E2DA] flex items-center justify-between">
          <h2 id="settings-modal-title" className="font-display text-xl font-semibold text-[#1C1926]">
            Workspace Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-[#524C61] hover:bg-[#FAF8F5] hover:text-[#1C1926]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Researcher Profile */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-[#797288]">Researcher Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#524C61]">Display Name</span>
                <input
                  type="text"
                  value={localProfile.name}
                  onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF8F5] border border-[#E7E2DA] text-[#1C1926] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#524C61]">Academic Role</span>
                <input
                  type="text"
                  value={localProfile.role}
                  onChange={(e) => setLocalProfile({ ...localProfile, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[#FAF8F5] border border-[#E7E2DA] text-[#1C1926] focus:outline-none focus:border-[#4C1D95] focus:bg-white"
                />
              </label>
            </div>
          </section>

          {/* AI Response Preferences */}
          <section className="space-y-4 pt-4 border-t border-[#F0ECE5]">
            <h3 className="text-xs font-semibold text-[#797288]">AI Reading Preferences</h3>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[#524C61] block">Explanation Depth</span>
              <div className="grid grid-cols-3 gap-2">
                {(["concise", "balanced", "detailed"] as const).map((depth) => (
                  <button
                    key={depth}
                    type="button"
                    onClick={() => setLocalSettings({ ...localSettings, responseDepth: depth })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-colors ${
                      localSettings.responseDepth === depth
                        ? "bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]"
                        : "bg-[#FAF8F5] text-[#524C61] border-[#E7E2DA] hover:bg-white"
                    }`}
                  >
                    {depth}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-[#1C1926]">Inline page &amp; section citations</p>
                <p className="text-xs text-[#797288]">
                  Reference specific pages, sections, and tables in chat replies
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.includeCitations}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, includeCitations: e.target.checked })
                }
                className="w-4 h-4 accent-[#4C1D95] rounded"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-[#1C1926]">Open Summary view after upload</p>
                <p className="text-xs text-[#797288]">
                  Show structured summary cards first instead of the split PDF workspace
                </p>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoOpenSummary}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoOpenSummary: e.target.checked })
                }
                className="w-4 h-4 accent-[#4C1D95] rounded"
              />
            </label>

            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#1C1926]">Default PDF Zoom</p>
                <p className="text-xs text-[#797288]">Initial scale when opening a paper</p>
              </div>
              <select
                value={String(localSettings.defaultZoom)}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, defaultZoom: Number(e.target.value) })
                }
                className="px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums bg-[#FAF8F5] border border-[#E7E2DA] text-[#1C1926] focus:outline-none focus:border-[#4C1D95]"
              >
                <option value="0.85">85%</option>
                <option value="1">100%</option>
                <option value="1.15">115%</option>
                <option value="1.3">130%</option>
              </select>
            </label>
          </section>

          {/* Local Browser Library Storage */}
          <section className="space-y-3 pt-4 border-t border-[#F0ECE5]">
            <h3 className="text-xs font-semibold text-[#797288]">Local Library Storage</h3>
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E7E2DA]">
              <div className="text-xs text-[#524C61] tabular-nums">
                <p className="font-semibold text-[#1C1926]">
                  {papers.length} {papers.length === 1 ? "paper" : "papers"} stored locally
                </p>
                <p className="text-[#797288] mt-0.5">{formatFileSize(totalBytes)} total PDF size</p>
              </div>

              {papers.length > 0 && (
                confirmClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClearLibrary();
                        setConfirmClear(false);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E86A58] text-white hover:bg-[#D45746]"
                    >
                      Confirm Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#524C61] hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#E86A58] hover:bg-[#FFF1EE] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Library</span>
                  </button>
                )
              )}
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-[#E7E2DA] bg-[#FAF8F5] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#524C61] hover:bg-[#EDE9FE]/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#4C1D95] text-white hover:bg-[#3B157A] transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
