import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Play,
  RotateCcw,
  Trash2,
  Undo2,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimationSpeed, DrawRecord, Student } from '../types/classroom';
import { playRevealFanfare, playTickSound } from '../utils/sound';

interface RandomPickerViewProps {
  students: Student[];
  isSimulatedRoster: boolean;
  allowRepeat: boolean;
  onAllowRepeatChange: (allow: boolean) => void;
  drawnRecords: DrawRecord[];
  onRecordDrawn: (student: Student) => void;
  onUndoRecord: (recordId: string) => void;
  onResetDrawnPool: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  onGoToRoster: () => void;
  onLoadSimulatedRoster: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  vRot: number;
  alpha: number;
}

export function RandomPickerView({
  students,
  isSimulatedRoster,
  allowRepeat,
  onAllowRepeatChange,
  drawnRecords,
  onRecordDrawn,
  onUndoRecord,
  onResetDrawnPool,
  isMuted,
  onToggleMute,
  volume,
  onVolumeChange,
  onGoToRoster,
  onLoadSimulatedRoster,
}: RandomPickerViewProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [speed, setSpeed] = useState<AnimationSpeed>('normal');
  const [reelIndex, setReelIndex] = useState(0);
  const [displayStudents, setDisplayStudents] = useState<{
    prev: string;
    current: string;
    next: string;
  }>({
    prev: '',
    current: '',
    next: '',
  });
  const [revealedStudent, setRevealedStudent] = useState<Student | null>(null);

  const timerRef = useRef<number | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRafRef = useRef<number | null>(null);

  // Use refs for audio settings inside timeout loops so mid-spin mute/volume changes apply immediately
  const mutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  useEffect(() => {
    mutedRef.current = isMuted;
    volumeRef.current = volume;
  }, [isMuted, volume]);

  const drawnIdSet = useMemo(
    () => new Set(drawnRecords.map((r) => r.studentId)),
    [drawnRecords],
  );

  const eligibleStudents = useMemo(() => {
    if (allowRepeat) return students;
    return students.filter((s) => !drawnIdSet.has(s.id));
  }, [students, allowRepeat, drawnIdSet]);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const launchConfetti = useCallback(() => {
    if (prefersReducedMotion) return;
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#E11D48', '#0EA5E9'];
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const particles: Particle[] = Array.from({ length: 56 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 3 + Math.random() * 7;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 5,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      };
    });

    if (confettiRafRef.current) {
      cancelAnimationFrame(confettiRafRef.current);
    }

    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = false;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gentle gravity
        p.vx *= 0.985;
        p.rotation += p.vRot;
        p.alpha -= 0.015;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.55);
          ctx.restore();
        }
      }

      if (alive) {
        confettiRafRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    confettiRafRef.current = requestAnimationFrame(animate);
  }, [prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (confettiRafRef.current) cancelAnimationFrame(confettiRafRef.current);
    };
  }, []);

  const handleDraw = useCallback(() => {
    if (isSpinning || eligibleStudents.length === 0) return;

    const winner = eligibleStudents[Math.floor(Math.random() * eligibleStudents.length)];

    if (prefersReducedMotion || eligibleStudents.length === 1) {
      setRevealedStudent(winner);
      setDisplayStudents({
        prev: '',
        current: winner.name,
        next: '',
      });
      playRevealFanfare(mutedRef.current, volumeRef.current);
      onRecordDrawn(winner);
      return;
    }

    setIsSpinning(true);
    setRevealedStudent(null);

    const pool = eligibleStudents.length >= 3 ? eligibleStudents : students;
    const totalSteps = speed === 'normal' ? 28 : 14;
    let step = 0;
    let pointer = Math.floor(Math.random() * pool.length);

    const getNameAt = (idx: number) => pool[(idx + pool.length) % pool.length]?.name ?? '';

    const runStep = () => {
      step++;
      pointer = (pointer + 1) % pool.length;
      const progress = step / totalSteps;

      if (step >= totalSteps) {
        const prevIdx = (pointer - 1 + pool.length) % pool.length;
        const nextIdx = (pointer + 1) % pool.length;
        setDisplayStudents({
          prev: getNameAt(prevIdx) === winner.name ? getNameAt(prevIdx - 1) : getNameAt(prevIdx),
          current: winner.name,
          next: getNameAt(nextIdx) === winner.name ? getNameAt(nextIdx + 1) : getNameAt(nextIdx),
        });
        setReelIndex((c) => c + 1);
        setIsSpinning(false);
        setRevealedStudent(winner);
        playRevealFanfare(mutedRef.current, volumeRef.current);
        launchConfetti();
        onRecordDrawn(winner);
        return;
      }

      // Pick random adjacent/pool names during fast phase for liveliness
      const currentStudent =
        step < totalSteps - 3
          ? pool[Math.floor(Math.random() * pool.length)]
          : pool[pointer];

      setDisplayStudents({
        prev: getNameAt(pointer - 1),
        current: currentStudent.name,
        next: getNameAt(pointer + 1),
      });
      setReelIndex((c) => c + 1);
      playTickSound(progress, mutedRef.current, volumeRef.current);

      // Ease-out interval curve
      const minDelay = speed === 'normal' ? 42 : 36;
      const maxDelay = speed === 'normal' ? 285 : 190;
      const easedDelay = minDelay + Math.pow(progress, 2.6) * (maxDelay - minDelay);

      timerRef.current = window.setTimeout(runStep, easedDelay);
    };

    runStep();
  }, [
    isSpinning,
    eligibleStudents,
    students,
    speed,
    prefersReducedMotion,
    launchConfetti,
    onRecordDrawn,
  ]);

  // Spacebar shortcut for rapid classroom calling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleDraw();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDraw]);

  const remainingCount = eligibleStudents.length;
  const totalCount = students.length;
  const drawnCount = allowRepeat ? drawnRecords.length : totalCount - remainingCount;
  const progressPercent = totalCount > 0 ? Math.round((drawnCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            隨機點名抽籤
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            按下開始抽籤或空白鍵（Space），系統將伴隨動畫與音效隨機選出一位學生。
          </p>
        </div>
        <div className="text-sm text-slate-500 tabular-nums">
          {isSimulatedRoster && students.length > 0 && (
            <>
              <span className="text-blue-700 font-medium">模擬名單</span>
              <span className="mx-2 text-slate-300" aria-hidden="true">
                ·
              </span>
            </>
          )}
          <span>總人數 {totalCount} 人</span>
          <span className="mx-2 text-slate-300" aria-hidden="true">
            ·
          </span>
          <span>{allowRepeat ? '允許重複抽取' : `本輪剩餘 ${remainingCount} 人`}</span>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl mx-auto">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
            <Users className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">目前沒有學生名單</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            請先前往「名單管理」上傳 CSV 檔案或貼上學生姓名，或直接載入模擬名單體驗隨機點名。
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Stage: Main Spotlight Picker */}
          <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 relative overflow-hidden">
            <canvas
              ref={confettiCanvasRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full z-10"
            />

            {/* Stage Top Metadata (Zero-Pill Unboxed Text) */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-500 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">點名舞台</span>
                <span aria-hidden="true">·</span>
                <span>{allowRepeat ? '允許重複模式' : '不重複模式'}</span>
                {!allowRepeat && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      可抽 {remainingCount} / {totalCount} 人
                    </span>
                  </>
                )}
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">
                快捷鍵：空白鍵 (Space) 開始抽取
              </span>
            </div>

            {/* Central Spotlight Slot Reel */}
            <div className="py-10 sm:py-14 flex flex-col items-center justify-center min-h-[340px] relative">
              {!allowRepeat && remainingCount === 0 && !isSpinning ? (
                <div className="text-center space-y-4 max-w-md">
                  <p className="text-sm font-medium text-emerald-700">本輪抽取完成</p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
                    全班 {totalCount} 位學生皆已抽過
                  </h2>
                  <p className="text-sm text-slate-600">
                    您可以重置已抽名單重新開始新一輪，或切換為「允許重複抽取」。
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setRevealedStudent(null);
                        onResetDrawnPool();
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" aria-hidden="true" />
                      <span>重置本輪名單</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-lg mx-auto flex flex-col items-center">
                  {/* Reel Window */}
                  <div className="w-full flex flex-col items-center justify-center gap-3 select-none">
                    {/* Upper Neighbour */}
                    <div className="h-8 flex items-center justify-center overflow-hidden">
                      <span
                        className={`text-lg sm:text-xl font-medium text-slate-300 transition-opacity duration-150 ${
                          isSpinning ? 'opacity-80' : 'opacity-0'
                        }`}
                      >
                        {displayStudents.prev}
                      </span>
                    </div>

                    {/* Focal Name Card */}
                    <div
                      className={`w-full rounded-2xl border px-6 py-9 sm:py-12 text-center transition-colors duration-200 ${
                        revealedStudent && !isSpinning
                          ? 'bg-blue-50/60 border-blue-300'
                          : isSpinning
                          ? 'bg-slate-50 border-slate-300'
                          : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={
                            isSpinning
                              ? `spin-${reelIndex}`
                              : revealedStudent
                              ? `winner-${revealedStudent.id}-${drawnRecords.length}`
                              : 'idle'
                          }
                          initial={
                            prefersReducedMotion
                              ? { opacity: 0 }
                              : isSpinning
                              ? { y: 18, opacity: 0.4 }
                              : { scale: 0.9, opacity: 0 }
                          }
                          animate={{ y: 0, scale: 1, opacity: 1 }}
                          exit={
                            prefersReducedMotion
                              ? { opacity: 0 }
                              : { y: -18, opacity: 0.25 }
                          }
                          transition={{
                            duration: isSpinning ? 0.06 : 0.28,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        >
                          {revealedStudent || isSpinning ? (
                            <div className="space-y-2">
                              {revealedStudent && !isSpinning && (
                                <p className="text-xs sm:text-sm font-semibold text-blue-700 tracking-wide">
                                  第 {String(drawnRecords[0]?.round ?? drawnRecords.length).padStart(2, '0')} 次抽中
                                </p>
                              )}
                              <div className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 break-words">
                                {isSpinning ? displayStudents.current : revealedStudent?.name}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-slate-500">準備就緒</p>
                              <div className="text-2xl sm:text-3xl font-bold text-slate-400">
                                點擊下方按鈕開始抽籤
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Lower Neighbour */}
                    <div className="h-8 flex items-center justify-center overflow-hidden">
                      <span
                        className={`text-lg sm:text-xl font-medium text-slate-300 transition-opacity duration-150 ${
                          isSpinning ? 'opacity-80' : 'opacity-0'
                        }`}
                      >
                        {displayStudents.next}
                      </span>
                    </div>
                  </div>

                  {/* Primary CTA */}
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={isSpinning || eligibleStudents.length === 0}
                      onClick={handleDraw}
                      className="inline-flex items-center justify-center gap-2.5 min-w-[190px] px-7 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                    >
                      <Play className="w-5 h-5 fill-current" aria-hidden="true" />
                      <span>
                        {isSpinning
                          ? '正在隨機抽取...'
                          : revealedStudent
                          ? '繼續抽下一位'
                          : '開始抽籤'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right Deck: Settings & Draw History */}
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            {/* Settings Block */}
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-slate-900">抽取設定</h2>

              {/* Repeat Mode Toggle */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">抽取規則</span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={() => onAllowRepeatChange(false)}
                    className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      !allowRepeat
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    不重複抽取
                  </button>
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={() => onAllowRepeatChange(true)}
                    className={`py-2 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      allowRepeat
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    允許重複
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {allowRepeat
                    ? '每位學生每次都有相同機率被抽中。'
                    : '已抽中的學生不會在本輪再次出現，直到重置名單。'}
                </p>
              </div>

              {/* Speed Setting */}
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">動畫節奏</span>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={() => setSpeed('normal')}
                    className={`py-1.5 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      speed === 'normal'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    標準節奏
                  </button>
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={() => setSpeed('fast')}
                    className={`py-1.5 px-3 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      speed === 'fast'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    快速抽取
                  </button>
                </div>
              </div>

              {/* Audio Controls */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">音效與音量</span>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      isMuted
                        ? 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100'
                        : 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>已靜音</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>音效開啟</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    aria-label="音效音量"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : Math.round(volume * 100)}
                    onChange={(e) => {
                      const next = Number(e.target.value) / 100;
                      onVolumeChange(next);
                      if (next > 0 && isMuted) {
                        onToggleMute();
                      }
                    }}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="w-10 text-right text-xs font-mono tabular-nums text-slate-600">
                    {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                  </span>
                </div>
              </div>

              {/* Non-repeat Progress Bar */}
              {!allowRepeat && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                    <span>本輪進度</span>
                    <span>
                      已抽 {totalCount - remainingCount} / {totalCount} 人 ({progressPercent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">
                  已抽中紀錄
                  <span className="ml-2 text-xs font-normal text-slate-500 tabular-nums">
                    ({drawnRecords.length})
                  </span>
                </h3>
                {drawnRecords.length > 0 && (
                  <button
                    type="button"
                    disabled={isSpinning}
                    onClick={() => {
                      setRevealedStudent(null);
                      onResetDrawnPool();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>清除並重置</span>
                  </button>
                )}
              </div>

              {drawnRecords.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  尚未有抽籤紀錄
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {drawnRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
                          #{String(rec.round).padStart(2, '0')}
                        </span>
                        <span className="font-medium text-slate-900 truncate">{rec.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 tabular-nums">
                          {new Date(rec.timestamp).toLocaleTimeString('zh-TW', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {!allowRepeat && (
                          <button
                            type="button"
                            disabled={isSpinning}
                            onClick={() => onUndoRecord(rec.id)}
                            title="放回待抽名單"
                            aria-label={`將 ${rec.name} 放回待抽名單`}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          >
                            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
