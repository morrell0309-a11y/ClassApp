import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  Minus,
  Pencil,
  Plus,
  Printer,
  Shuffle,
  Users,
} from 'lucide-react';
import { RemainderStrategy, Student, StudentGroup } from '../types/classroom';
import { getInitials } from '../utils/grouping';
import { playShuffleSound, playSwapSound } from '../utils/sound';

interface GroupingViewProps {
  students: Student[];
  isSimulatedRoster: boolean;
  groups: StudentGroup[];
  perGroupSize: number;
  remainderStrategy: RemainderStrategy;
  onPerGroupSizeChange: (size: number) => void;
  onRemainderStrategyChange: (strategy: RemainderStrategy) => void;
  onGenerateGroups: (size?: number, strategy?: RemainderStrategy) => void;
  onSwapStudents: (
    sourceGroupId: string,
    sourceStudentId: string,
    targetGroupId: string,
    targetStudentId: string,
  ) => void;
  onRenameGroup: (groupId: string, newLabel: string) => void;
  isMuted: boolean;
  volume: number;
  onGoToRoster: () => void;
  onLoadSimulatedRoster: () => void;
}

export function GroupingView({
  students,
  isSimulatedRoster,
  groups,
  perGroupSize,
  remainderStrategy,
  onPerGroupSizeChange,
  onRemainderStrategyChange,
  onGenerateGroups,
  onSwapStudents,
  onRenameGroup,
  isMuted,
  volume,
  onGoToRoster,
  onLoadSimulatedRoster,
}: GroupingViewProps) {
  const [selectedForSwap, setSelectedForSwap] = useState<{
    groupId: string;
    studentId: string;
    name: string;
  } | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [downloadedCsvNotice, setDownloadedCsvNotice] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);

  const previewSummary = useMemo(() => {
    const total = students.length;
    if (total === 0) return '目前沒有學生';
    const size = Math.max(1, Math.min(perGroupSize, total));
    if (remainderStrategy === 'separate' || total <= size) {
      const fullGroups = Math.floor(total / size);
      const rem = total % size;
      if (rem === 0) {
        return `${total} 位學生 · 共 ${fullGroups} 組 · 每組 ${size} 人`;
      }
      return `${total} 位學生 · 共 ${fullGroups + 1} 組（${fullGroups} 組 ${size} 人 + 1 組 ${rem} 人）`;
    } else {
      const numGroups = Math.max(1, Math.floor(total / size));
      const base = Math.floor(total / numGroups);
      const extra = total % numGroups;
      if (extra === 0) {
        return `${total} 位學生 · 共 ${numGroups} 組 · 每組 ${base} 人`;
      }
      return `${total} 位學生 · 共 ${numGroups} 組（${extra} 組 ${base + 1} 人 + ${numGroups - extra} 組 ${base} 人）`;
    }
  }, [students.length, perGroupSize, remainderStrategy]);

  const handleRegroup = (nextSize?: number, nextStrategy?: RemainderStrategy) => {
    setSelectedForSwap(null);
    setShuffleKey((k) => k + 1);
    playShuffleSound(isMuted, volume);
    onGenerateGroups(nextSize, nextStrategy);
  };

  const handleStudentClick = (groupId: string, student: Student) => {
    if (!selectedForSwap) {
      setSelectedForSwap({ groupId, studentId: student.id, name: student.name });
      return;
    }

    if (selectedForSwap.studentId === student.id && selectedForSwap.groupId === groupId) {
      setSelectedForSwap(null);
      return;
    }

    onSwapStudents(selectedForSwap.groupId, selectedForSwap.studentId, groupId, student.id);
    playSwapSound(isMuted, volume);
    setSelectedForSwap(null);
  };

  const handleCopyText = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map((g) => `${g.label}（${g.members.length}人）：${g.members.map((m) => m.name).join('、')}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      window.setTimeout(() => setCopiedNotice(false), 2500);
    } catch {
      // Fallback ignored silently if clipboard blocked
    }
  };

  const handleExportCsv = () => {
    if (groups.length === 0) return;
    const rows = ['組別,組內序號,學生姓名'];
    groups.forEach((g) => {
      g.members.forEach((m, idx) => {
        const escapedLabel = `"${g.label.replace(/"/g, '""')}"`;
        const escapedName = `"${m.name.replace(/"/g, '""')}"`;
        rows.push(`${escapedLabel},${idx + 1},${escapedName}`);
      });
    });
    const bom = '\uFEFF';
    const blob = new Blob([bom + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `課堂分組結果_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloadedCsvNotice(true);
    window.setTimeout(() => setDownloadedCsvNotice(false), 2500);
  };

  const quickPresets = [2, 3, 4, 5, 6];
  const maxGroupSize = Math.max(2, students.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            自動視覺化分組
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            設定每組人數並隨機分組，分組結果將以視覺化小組席位呈現，也可手動互換或下載 CSV。
          </p>
        </div>
        <div className="text-sm text-slate-600 tabular-nums font-medium">
          {isSimulatedRoster && students.length > 0 && (
            <>
              <span className="text-blue-700">模擬名單</span>
              <span className="mx-2 text-slate-300" aria-hidden="true">
                ·
              </span>
            </>
          )}
          <span>{previewSummary}</span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
            <Users className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">目前沒有學生名單</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            請先前往「名單管理」上傳 CSV 檔案或貼上學生姓名，或直接載入模擬名單體驗分組功能。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onLoadSimulatedRoster}
              className="px-5 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              載入模擬名單 (24 人)
            </button>
            <button
              type="button"
              onClick={onGoToRoster}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              前往匯入名單
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Controls Toolbar */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 no-print">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              {/* Group Size Controls */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                    每組人數
                  </span>
                  <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                    <button
                      type="button"
                      aria-label="減少每組人數"
                      disabled={perGroupSize <= 2}
                      onClick={() => {
                        const next = Math.max(2, perGroupSize - 1);
                        onPerGroupSizeChange(next);
                        handleRegroup(next);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Minus className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <span className="w-12 text-center text-base font-bold font-mono tabular-nums text-slate-900">
                      {perGroupSize}
                    </span>
                    <button
                      type="button"
                      aria-label="增加每組人數"
                      disabled={perGroupSize >= maxGroupSize}
                      onClick={() => {
                        const next = Math.min(maxGroupSize, perGroupSize + 1);
                        onPerGroupSizeChange(next);
                        handleRegroup(next);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={preset > maxGroupSize}
                      onClick={() => {
                        onPerGroupSizeChange(preset);
                        handleRegroup(preset);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                        perGroupSize === preset
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {preset} 人
                    </button>
                  ))}
                </div>

                {/* Remainder Strategy */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600 whitespace-nowrap">
                    餘數處理：
                  </span>
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        onRemainderStrategyChange('distribute');
                        handleRegroup(undefined, 'distribute');
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        remainderStrategy === 'distribute'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      平均補入各組
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRemainderStrategyChange('separate');
                        handleRegroup(undefined, 'separate');
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        remainderStrategy === 'separate'
                          ? 'bg-white text-slate-900 shadow-xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      餘數獨立一組
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleRegroup()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Shuffle className="w-4 h-4" aria-hidden="true" />
                  <span>重新隨機分組</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedNotice ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700">已複製</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" aria-hidden="true" />
                      <span>複製結果</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  {downloadedCsvNotice ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                      <span className="text-emerald-700">已下載 CSV</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" aria-hidden="true" />
                      <span>下載分組 CSV</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  <span>列印</span>
                </button>
              </div>
            </div>

            {/* Visual Distribution Bar & Swap Helper */}
            {groups.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>各組人數視覺分佈</span>
                  <span className="flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    {selectedForSwap ? (
                      <span className="font-semibold text-blue-700">
                        已選取「{selectedForSwap.name}」，請點擊另一位學生進行組別互換（或再點一次取消）
                      </span>
                    ) : (
                      <span>點擊任意兩位學生即可手動互換組別 · 點擊組別標題可自訂名稱</span>
                    )}
                  </span>
                </div>

                {/* Proportional Visual Bar */}
                <div className="flex h-3 w-full rounded-full overflow-hidden gap-0.5 bg-slate-100">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      style={{ flexGrow: group.members.length }}
                      title={`${group.label}：${group.members.length} 人`}
                      className={`${group.theme.barBg} transition-all duration-300`}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Print-only Header */}
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-bold text-slate-900">課堂分組名單</h2>
            <p className="text-sm text-slate-600">{previewSummary}</p>
          </div>

          {/* Visual Classroom Pods Grid */}
          <section
            aria-label="分組視覺化結果"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {groups.map((group, groupIdx) => {
              const isEditing = editingGroupId === group.id;
              return (
                <motion.article
                  key={`${group.id}-${shuffleKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    delay: Math.min(groupIdx * 0.035, 0.28),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col"
                >
                  {/* Top Color Header Bar */}
                  <div className={`h-2 w-full ${group.theme.barBg}`} aria-hidden="true" />

                  {/* Group Pod Header */}
                  <div className={`px-5 py-3.5 border-b border-slate-100 ${group.theme.softBg} flex items-center justify-between gap-2`}>
                    {isEditing ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (editingLabel.trim()) {
                            onRenameGroup(group.id, editingLabel.trim());
                          }
                          setEditingGroupId(null);
                        }}
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onBlur={() => {
                            if (editingLabel.trim()) {
                              onRenameGroup(group.id, editingLabel.trim());
                            }
                            setEditingGroupId(null);
                          }}
                          className="w-full px-2 py-1 text-sm font-semibold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGroupId(group.id);
                          setEditingLabel(group.label);
                        }}
                        title="點擊修改組別名稱"
                        className="group inline-flex items-center gap-1.5 text-left min-w-0 cursor-pointer"
                      >
                        <h3 className={`text-base font-bold truncate ${group.theme.text}`}>
                          {group.label}
                        </h3>
                        <Pencil
                          className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 no-print"
                          aria-hidden="true"
                        />
                      </button>
                    )}

                    <span className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
                      {group.members.length} 人
                    </span>
                  </div>

                  {/* Visual Seat Members */}
                  <div className="p-4 space-y-2 flex-1">
                    {group.members.map((member, memberIdx) => {
                      const isSelected =
                        selectedForSwap?.studentId === member.id &&
                        selectedForSwap?.groupId === group.id;

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleStudentClick(group.id, member)}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                            isSelected
                              ? `bg-blue-50 border-blue-500 ring-2 ring-blue-500/30`
                              : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              aria-hidden="true"
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${group.theme.avatarBg} ${group.theme.avatarText}`}
                            >
                              {getInitials(member.name)}
                            </span>
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {member.name}
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                            {String(memberIdx + 1).padStart(2, '0')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
