import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { CsvPreviewData, Student } from '../types/classroom';
import {
  createStudentId,
  createStudentsFromNames,
  decodeTextBuffer,
  deduplicateNames,
  parseCsvPreview,
  parsePastedNames,
  SAMPLE_STUDENT_NAMES,
  SIMULATED_PASTE_TEXT,
} from '../utils/csvParser';

interface RosterPanelProps {
  students: Student[];
  isSimulatedRoster: boolean;
  onReplaceRoster: (newStudents: Student[], isSimulated?: boolean) => void;
  onAppendRoster: (newStudents: Student[]) => void;
  onAddSingleStudent: (name: string) => void;
  onRemoveStudent: (id: string) => void;
  onDeduplicate: () => number;
  onClearRoster: () => void;
  onNavigateToFeature: (target: 'picker' | 'grouping') => void;
}

export function RosterPanel({
  students,
  isSimulatedRoster,
  onReplaceRoster,
  onAppendRoster,
  onAddSingleStudent,
  onRemoveStudent,
  onDeduplicate,
  onClearRoster,
  onNavigateToFeature,
}: RosterPanelProps) {
  const [importMode, setImportMode] = useState<'csv' | 'paste'>('csv');
  const [pasteText, setPasteText] = useState('');
  const [singleName, setSingleName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewData | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<number>(0);
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedPasteNames = useMemo(() => parsePastedNames(pasteText), [pasteText]);

  // Paste preview with duplicate detection
  const pastePreviewAnalysis = useMemo(() => {
    const seen = new Set<string>();
    let duplicateCount = 0;
    const items = parsedPasteNames.map((name, idx) => {
      const isDuplicate = seen.has(name);
      if (isDuplicate) {
        duplicateCount++;
      } else {
        seen.add(name);
      }
      return {
        index: idx + 1,
        name,
        isDuplicate,
      };
    });
    return { items, duplicateCount };
  }, [parsedPasteNames]);

  // CSV preview rows & duplicate detection
  const csvPreviewAnalysis = useMemo(() => {
    if (!csvPreview) {
      return {
        allRows: [] as string[][],
        duplicateRowIndices: new Set<number>(),
        duplicateCount: 0,
        extractedNames: [] as string[],
      };
    }

    const allRows = csvPreview.hasHeader
      ? [csvPreview.headers, ...csvPreview.rows]
      : csvPreview.rows;

    const seen = new Set<string>();
    const duplicateRowIndices = new Set<number>();
    const extractedNames: string[] = [];
    let duplicateCount = 0;

    allRows.forEach((row, rowIdx) => {
      if (hasHeaderRow && rowIdx === 0) return;
      const name = (row[selectedColumn] ?? '').trim();
      if (!name) return;
      extractedNames.push(name);
      if (seen.has(name)) {
        duplicateRowIndices.add(rowIdx);
        duplicateCount++;
      } else {
        seen.add(name);
      }
    });

    return {
      allRows,
      duplicateRowIndices,
      duplicateCount,
      extractedNames,
    };
  }, [csvPreview, hasHeaderRow, selectedColumn]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, searchQuery]);

  // Duplicate detection in current roster
  const currentRosterDuplicateIds = useMemo(() => {
    const seen = new Set<string>();
    const dupIds = new Set<string>();
    for (const s of students) {
      if (seen.has(s.name)) {
        dupIds.add(s.id);
      } else {
        seen.add(s.name);
      }
    }
    return dupIds;
  }, [students]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    window.setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleFileProcess = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeTextBuffer(buffer);
      const preview = parseCsvPreview(text, file.name);

      if (preview.rows.length === 0) {
        showFeedback('檔案內容為空，請確認後再試。');
        return;
      }

      setCsvPreview(preview);
      setSelectedColumn(preview.detectedNameColumn);
      setHasHeaderRow(preview.hasHeader);
    } catch {
      showFeedback('讀取檔案失敗，請確認檔案格式為 CSV 或純文字檔。');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileProcess(file);
    }
  };

  const handleDeduplicateCsvPreview = () => {
    if (!csvPreview) return;
    const { allRows, duplicateRowIndices, duplicateCount } = csvPreviewAnalysis;
    if (duplicateCount === 0) return;

    const filteredRows = allRows.filter((_, idx) => !duplicateRowIndices.has(idx));

    if (csvPreview.hasHeader) {
      setCsvPreview({
        ...csvPreview,
        headers: filteredRows[0] ?? csvPreview.headers,
        rows: filteredRows.slice(1),
      });
    } else {
      setCsvPreview({
        ...csvPreview,
        rows: filteredRows,
      });
    }
    showFeedback(`已從 CSV 預覽名單移除 ${duplicateCount} 筆重複姓名。`);
  };

  const handleConfirmCsvImport = (mode: 'replace' | 'append') => {
    const names = csvPreviewAnalysis.extractedNames;
    if (names.length === 0) {
      showFeedback('所選欄位沒有可用的學生姓名。');
      return;
    }
    const newStudents = createStudentsFromNames(names);
    if (mode === 'replace') {
      onReplaceRoster(newStudents, false);
      showFeedback(`已從 ${csvPreview?.fileName} 匯入 ${newStudents.length} 位學生。`);
    } else {
      onAppendRoster(newStudents);
      showFeedback(`已從 ${csvPreview?.fileName} 追加 ${newStudents.length} 位學生。`);
    }
    setCsvPreview(null);
  };

  const handleDeduplicatePaste = () => {
    const { unique, removedCount } = deduplicateNames(parsedPasteNames);
    if (removedCount === 0) return;
    setPasteText(unique.join('\n'));
    showFeedback(`已從貼上預覽移除 ${removedCount} 筆重複姓名。`);
  };

  const handlePasteImport = (mode: 'replace' | 'append') => {
    if (parsedPasteNames.length === 0) return;
    const newStudents = createStudentsFromNames(parsedPasteNames);
    if (mode === 'replace') {
      onReplaceRoster(newStudents, false);
      showFeedback(`已更新為 ${newStudents.length} 位學生名單。`);
    } else {
      onAppendRoster(newStudents);
      showFeedback(`已追加 ${newStudents.length} 位學生至名單。`);
    }
    setPasteText('');
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = singleName.trim();
    if (!trimmed) return;
    onAddSingleStudent(trimmed);
    setSingleName('');
  };

  const handleLoadSimulatedRoster = () => {
    const sample = SAMPLE_STUDENT_NAMES.map((name) => ({
      id: createStudentId(),
      name,
    }));
    onReplaceRoster(sample, true);
    showFeedback(`已載入 ${sample.length} 位模擬學生名單，您可立即前往「隨機點名」或「自動分組」體驗操作。`);
  };

  const handleDownloadSampleCsv = () => {
    const csvRows = ['座號,姓名', ...SAMPLE_STUDENT_NAMES.map((n, i) => `${i + 1},${n}`)];
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '模擬班級名單範例.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Jump */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            班級名單管理
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            支援上傳 CSV 試算表、貼上學生姓名，或一鍵載入模擬名單快速體驗課堂點名與分組功能。
          </p>
        </div>
        {students.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateToFeature('picker')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              前往隨機點名
            </button>
            <button
              type="button"
              onClick={() => onNavigateToFeature('grouping')}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              前往自動分組
            </button>
          </div>
        )}
      </div>

      {/* Simulated Roster Quick-Start Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-slate-900">
            模擬名單體驗
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            手邊暫時沒有班級名單？載入預設的 24 位模擬學生名單，快速熟悉抽籤動畫與視覺分組流程。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>下載模擬 CSV</span>
          </button>
          <button
            type="button"
            onClick={handleLoadSimulatedRoster}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>載入模擬名單 (24 人)</span>
          </button>
        </div>
      </section>

      {feedbackMsg && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-medium rounded-xl"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
            aria-label="關閉提示"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Zone: Import Sources */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-semibold text-slate-900">匯入名單來源</h2>
            {/* Segmented Control */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setImportMode('csv')}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  importMode === 'csv'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                上傳 CSV 檔案
              </button>
              <button
                type="button"
                onClick={() => setImportMode('paste')}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  importMode === 'paste'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                貼上學生姓名
              </button>
            </div>
          </div>

          {importMode === 'csv' ? (
            <div className="space-y-5">
              {!csvPreview ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/70'
                      : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/80'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv,text/csv,text/plain"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <p className="text-base font-semibold text-slate-900">
                    拖曳 CSV 檔案至此，或點擊選擇檔案
                  </p>
                  <p className="mt-1.5 text-sm text-slate-500">
                    支援 Excel 匯出的 UTF-8 / Big5 編碼 CSV、TSV 或純文字檔（系統將自動標記重複姓名）
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    選擇檔案
                  </span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <div className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-slate-900">{csvPreview.fileName}</span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-600 tabular-nums">
                        共偵測到 {csvPreviewAnalysis.extractedNames.length} 筆姓名
                      </span>
                      {csvPreviewAnalysis.duplicateCount > 0 && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1 text-amber-800 font-semibold tabular-nums">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            發現 {csvPreviewAnalysis.duplicateCount} 筆重複
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCsvPreview(null)}
                      className="text-sm text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      重新選擇檔案
                    </button>
                  </div>

                  {/* Duplicate Warning & One-Click Removal Bar */}
                  {csvPreviewAnalysis.duplicateCount > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center gap-2 text-sm text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                        <span>
                          預覽名單中有{' '}
                          <strong className="font-semibold tabular-nums">
                            {csvPreviewAnalysis.duplicateCount}
                          </strong>{' '}
                          筆重複的學生姓名，已在下方表格標記。
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeduplicateCsvPreview}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        一鍵移除重複姓名 ({csvPreviewAnalysis.duplicateCount})
                      </button>
                    </div>
                  )}

                  {/* Column & Header Selection */}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label htmlFor="csv-col-select" className="text-sm font-medium text-slate-700">
                        姓名所在欄位：
                      </label>
                      <select
                        id="csv-col-select"
                        value={selectedColumn}
                        onChange={(e) => setSelectedColumn(Number(e.target.value))}
                        className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {csvPreview.headers.map((header, idx) => (
                          <option key={idx} value={idx}>
                            第 {idx + 1} 欄（{header}）
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasHeaderRow}
                        onChange={(e) => setHasHeaderRow(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>第一列為標題列（匯入時略過）</span>
                    </label>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-72 overflow-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-medium w-12 text-center">#</th>
                            {csvPreview.headers.map((h, colIdx) => (
                              <th
                                key={colIdx}
                                onClick={() => setSelectedColumn(colIdx)}
                                className={`px-3 py-2 font-medium whitespace-nowrap cursor-pointer transition-colors ${
                                  selectedColumn === colIdx
                                    ? 'bg-blue-50 text-blue-800'
                                    : 'hover:bg-slate-100'
                                }`}
                              >
                                {h}
                                {selectedColumn === colIdx ? ' (姓名欄)' : ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {csvPreviewAnalysis.allRows.map((row, rowIdx) => {
                            const isSkippedHeader = hasHeaderRow && rowIdx === 0;
                            const isDuplicate = csvPreviewAnalysis.duplicateRowIndices.has(rowIdx);
                            return (
                              <tr
                                key={rowIdx}
                                className={
                                  isSkippedHeader
                                    ? 'bg-slate-50/80 text-slate-400 line-through'
                                    : isDuplicate
                                    ? 'bg-amber-50/80'
                                    : ''
                                }
                              >
                                <td className="px-3 py-2 text-xs font-mono tabular-nums text-slate-400 text-center">
                                  {isSkippedHeader ? '標題' : String(hasHeaderRow ? rowIdx : rowIdx + 1).padStart(2, '0')}
                                </td>
                                {row.map((cell, colIdx) => (
                                  <td
                                    key={colIdx}
                                    className={`px-3 py-2 whitespace-nowrap tabular-nums ${
                                      selectedColumn === colIdx && !isSkippedHeader
                                        ? isDuplicate
                                          ? 'font-semibold text-amber-950'
                                          : 'bg-blue-50/40 font-medium text-slate-900'
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    <span>{cell || '—'}</span>
                                    {selectedColumn === colIdx && isDuplicate && !isSkippedHeader && (
                                      <span className="inline-flex items-center gap-1 ml-2.5 text-xs font-medium text-amber-800">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                        重複姓名
                                      </span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmCsvImport('append')}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                    >
                      追加至現有名單
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmCsvImport('replace')}
                      className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                    >
                      取代並匯入 ({csvPreviewAnalysis.extractedNames.length} 人)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label htmlFor="paste-roster-input" className="text-sm font-medium text-slate-700">
                    貼上或輸入學生姓名（可用換行、逗號、頓號或 Tab 分隔）
                  </label>
                  <button
                    type="button"
                    onClick={() => setPasteText(SIMULATED_PASTE_TEXT)}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                  >
                    填入模擬文字（含重複範例）
                  </button>
                </div>
                <textarea
                  id="paste-roster-input"
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'範例：\n陳柏翰\n林欣妤\n黃宇辰\n張語彤\n\n或直接從 Excel / Google 試算表複製姓名欄位貼上'}
                  className="w-full px-3.5 py-3 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 placeholder:text-slate-400"
                />
              </div>

              {/* Live Paste Preview with Duplicate Marking & One-Click Removal */}
              {pastePreviewAnalysis.items.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div
                    className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
                      pastePreviewAnalysis.duplicateCount > 0
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="text-sm flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 tabular-nums">
                        貼上預覽名單 · 共 {pastePreviewAnalysis.items.length} 筆
                      </span>
                      {pastePreviewAnalysis.duplicateCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-800 font-semibold tabular-nums">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          發現 {pastePreviewAnalysis.duplicateCount} 筆重複姓名
                        </span>
                      )}
                    </div>

                    {pastePreviewAnalysis.duplicateCount > 0 && (
                      <button
                        type="button"
                        onClick={handleDeduplicatePaste}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        一鍵移除重複姓名 ({pastePreviewAnalysis.duplicateCount})
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
                    {pastePreviewAnalysis.items.map((item) => (
                      <div
                        key={`${item.index}-${item.name}`}
                        className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${
                          item.isDuplicate ? 'bg-amber-50/75' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-xs font-mono tabular-nums text-slate-400 shrink-0">
                            {String(item.index).padStart(2, '0')}
                          </span>
                          <span
                            className={`truncate ${
                              item.isDuplicate
                                ? 'font-semibold text-amber-950'
                                : 'font-medium text-slate-900'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                        {item.isDuplicate && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            重複姓名
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <span className="text-sm text-slate-600 tabular-nums">
                  {parsedPasteNames.length > 0
                    ? `共 ${parsedPasteNames.length} 筆（不重複 ${
                        parsedPasteNames.length - pastePreviewAnalysis.duplicateCount
                      } 人）`
                    : '尚未輸入姓名'}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={parsedPasteNames.length === 0}
                    onClick={() => handlePasteImport('append')}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                  >
                    追加至現有名單
                  </button>
                  <button
                    type="button"
                    disabled={parsedPasteNames.length === 0}
                    onClick={() => handlePasteImport('replace')}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                  >
                    取代現有名單
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Zone: Current Roster List */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">目前班級名單</h2>
              <p className="text-sm text-slate-500 tabular-nums mt-0.5">
                {isSimulatedRoster && students.length > 0 && (
                  <>
                    <span className="text-blue-700 font-medium">模擬名單</span>
                    <span className="mx-1.5 text-slate-300" aria-hidden="true">
                      ·
                    </span>
                  </>
                )}
                共 {students.length} 位學生
                {currentRosterDuplicateIds.size > 0 && (
                  <>
                    <span className="mx-1.5 text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-amber-700 font-medium">
                      含 {currentRosterDuplicateIds.size} 筆重複姓名
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {currentRosterDuplicateIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const removed = onDeduplicate();
                    showFeedback(`已移除 ${removed} 筆重複姓名。`);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  一鍵移除重複
                </button>
              )}
              {students.length > 0 && !confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  清空名單
                </button>
              )}
              {confirmClear && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClearRoster();
                      setConfirmClear(false);
                      showFeedback('已清空班級名單。');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                  >
                    確定清空
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Single Student Quick Add */}
          <form onSubmit={handleAddSingle} className="flex items-center gap-2">
            <div className="relative flex-1">
              <UserPlus
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="新增單一學生姓名..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={!singleName.trim()}
              className="inline-flex items-center gap-1 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>新增</span>
            </button>
          </form>

          {/* Search Filter when list is non-trivial */}
          {students.length > 6 && (
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋學生姓名..."
                className="w-full pl-9 pr-8 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="清除搜尋"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Student List */}
          {students.length === 0 ? (
            <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl space-y-3">
              <p className="text-sm font-medium text-slate-700">目前尚未建立學生名單</p>
              <p className="text-xs text-slate-500">
                請從左側上傳 CSV、貼上學生姓名，或點擊下方按鈕載入模擬名單。
              </p>
              <button
                type="button"
                onClick={handleLoadSimulatedRoster}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>載入模擬名單</span>
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              找不到符合「{searchQuery}」的學生
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {filteredStudents.map((student) => {
                const originalIndex = students.findIndex((s) => s.id === student.id) + 1;
                const isDup = currentRosterDuplicateIds.has(student.id);
                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                      isDup ? 'bg-amber-50/75 hover:bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 text-xs font-mono tabular-nums text-slate-400 shrink-0">
                        {String(originalIndex).padStart(2, '0')}
                      </span>
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {student.name}
                      </span>
                      {isDup && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          重複
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveStudent(student.id)}
                      aria-label={`移除 ${student.name}`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
