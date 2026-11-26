import { useCallback, useEffect, useState } from 'react';
import { GroupingView } from './components/GroupingView';
import { Header } from './components/Header';
import { RandomPickerView } from './components/RandomPickerView';
import { RosterPanel } from './components/RosterPanel';
import {
  AppTab,
  DrawRecord,
  RemainderStrategy,
  Student,
  StudentGroup,
} from './types/classroom';
import {
  createStudentId,
  createStudentsFromNames,
  SAMPLE_STUDENT_NAMES,
} from './utils/csvParser';
import { createGroups } from './utils/grouping';

const STORAGE_KEYS = {
  ROSTER: 'classroom_toolkit_roster_v1',
  IS_SIMULATED: 'classroom_toolkit_is_simulated_v1',
  SETTINGS: 'classroom_toolkit_settings_v1',
};

function loadInitialRosterState(): { students: Student[]; isSimulated: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROSTER);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (item): item is Student =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as Student).id === 'string' &&
            typeof (item as Student).name === 'string',
        );
        const simFlag = localStorage.getItem(STORAGE_KEYS.IS_SIMULATED) === 'true';
        return { students: valid, isSimulated: simFlag };
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    students: createStudentsFromNames(SAMPLE_STUDENT_NAMES),
    isSimulated: true,
  };
}

interface StoredSettings {
  allowRepeat: boolean;
  perGroupSize: number;
  remainderStrategy: RemainderStrategy;
  isMuted: boolean;
  volume: number;
}

function loadInitialSettings(): StoredSettings {
  const defaults: StoredSettings = {
    allowRepeat: false,
    perGroupSize: 4,
    remainderStrategy: 'distribute',
    isMuted: false,
    volume: 0.75,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      allowRepeat: typeof parsed.allowRepeat === 'boolean' ? parsed.allowRepeat : defaults.allowRepeat,
      perGroupSize:
        typeof parsed.perGroupSize === 'number' && parsed.perGroupSize >= 2
          ? parsed.perGroupSize
          : defaults.perGroupSize,
      remainderStrategy:
        parsed.remainderStrategy === 'separate' ? 'separate' : 'distribute',
      isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : defaults.isMuted,
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : defaults.volume,
    };
  } catch {
    return defaults;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('picker');
  const [initialRoster] = useState(loadInitialRosterState);
  const [students, setStudents] = useState<Student[]>(initialRoster.students);
  const [isSimulatedRoster, setIsSimulatedRoster] = useState<boolean>(initialRoster.isSimulated);

  const initialSettings = loadInitialSettings();
  const [allowRepeat, setAllowRepeat] = useState<boolean>(initialSettings.allowRepeat);
  const [perGroupSize, setPerGroupSize] = useState<number>(initialSettings.perGroupSize);
  const [remainderStrategy, setRemainderStrategy] = useState<RemainderStrategy>(
    initialSettings.remainderStrategy,
  );
  const [isMuted, setIsMuted] = useState<boolean>(initialSettings.isMuted);
  const [volume, setVolume] = useState<number>(initialSettings.volume);

  const [drawnRecords, setDrawnRecords] = useState<DrawRecord[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>(() =>
    createGroups(
      initialRoster.students,
      initialSettings.perGroupSize,
      initialSettings.remainderStrategy,
    ),
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROSTER, JSON.stringify(students));
      localStorage.setItem(STORAGE_KEYS.IS_SIMULATED, String(isSimulatedRoster));
    } catch {
      // Ignore storage quota errors
    }
  }, [students, isSimulatedRoster]);

  useEffect(() => {
    try {
      const settings: StoredSettings = {
        allowRepeat,
        perGroupSize,
        remainderStrategy,
        isMuted,
        volume,
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [allowRepeat, perGroupSize, remainderStrategy, isMuted, volume]);

  const syncGroupsToStudents = useCallback(
    (nextStudents: Student[], size = perGroupSize, strategy = remainderStrategy) => {
      setGroups(createGroups(nextStudents, size, strategy));
    },
    [perGroupSize, remainderStrategy],
  );

  const handleReplaceRoster = (newStudents: Student[], isSimulated = false) => {
    setStudents(newStudents);
    setIsSimulatedRoster(isSimulated);
    setDrawnRecords([]);
    syncGroupsToStudents(newStudents);
  };

  const handleLoadSimulatedRoster = () => {
    const sample = createStudentsFromNames(SAMPLE_STUDENT_NAMES);
    handleReplaceRoster(sample, true);
  };

  const handleAppendRoster = (newStudents: Student[]) => {
    const next = [...students, ...newStudents];
    setStudents(next);
    setIsSimulatedRoster(false);
    syncGroupsToStudents(next);
  };

  const handleAddSingleStudent = (name: string) => {
    const newStudent: Student = { id: createStudentId(), name };
    const next = [...students, newStudent];
    setStudents(next);
    setIsSimulatedRoster(false);
    syncGroupsToStudents(next);
  };

  const handleRemoveStudent = (id: string) => {
    const next = students.filter((s) => s.id !== id);
    setStudents(next);
    setDrawnRecords((prev) => prev.filter((r) => r.studentId !== id));
    syncGroupsToStudents(next);
  };

  const handleDeduplicate = (): number => {
    const seen = new Set<string>();
    const unique: Student[] = [];
    for (const s of students) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        unique.push(s);
      }
    }
    const removedCount = students.length - unique.length;
    if (removedCount > 0) {
      setStudents(unique);
      const validIds = new Set(unique.map((u) => u.id));
      setDrawnRecords((prev) => prev.filter((r) => validIds.has(r.studentId)));
      syncGroupsToStudents(unique);
    }
    return removedCount;
  };

  const handleClearRoster = () => {
    setStudents([]);
    setIsSimulatedRoster(false);
    setDrawnRecords([]);
    setGroups([]);
  };

  const handleRecordDrawn = useCallback((student: Student) => {
    setDrawnRecords((prev) => {
      const nextRound = prev.length > 0 ? prev[0].round + 1 : 1;
      const newRecord: DrawRecord = {
        id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        studentId: student.id,
        name: student.name,
        round: nextRound,
        timestamp: Date.now(),
      };
      return [newRecord, ...prev];
    });
  }, []);

  const handleUndoRecord = (recordId: string) => {
    setDrawnRecords((prev) => prev.filter((r) => r.id !== recordId));
  };

  const handleResetDrawnPool = () => {
    setDrawnRecords([]);
  };

  const handleGenerateGroups = (size?: number, strategy?: RemainderStrategy) => {
    const targetSize = size ?? perGroupSize;
    const targetStrategy = strategy ?? remainderStrategy;
    setGroups(createGroups(students, targetSize, targetStrategy));
  };

  const handleSwapStudents = (
    sourceGroupId: string,
    sourceStudentId: string,
    targetGroupId: string,
    targetStudentId: string,
  ) => {
    setGroups((prev) => {
      const sourceGroup = prev.find((g) => g.id === sourceGroupId);
      const targetGroup = prev.find((g) => g.id === targetGroupId);
      if (!sourceGroup || !targetGroup) return prev;

      const sourceStudent = sourceGroup.members.find((m) => m.id === sourceStudentId);
      const targetStudent = targetGroup.members.find((m) => m.id === targetStudentId);
      if (!sourceStudent || !targetStudent) return prev;

      if (sourceGroupId === targetGroupId) {
        return prev.map((g) => {
          if (g.id !== sourceGroupId) return g;
          return {
            ...g,
            members: g.members.map((m) => {
              if (m.id === sourceStudentId) return targetStudent;
              if (m.id === targetStudentId) return sourceStudent;
              return m;
            }),
          };
        });
      }

      return prev.map((g) => {
        if (g.id === sourceGroupId) {
          return {
            ...g,
            members: g.members.map((m) => (m.id === sourceStudentId ? targetStudent : m)),
          };
        }
        if (g.id === targetGroupId) {
          return {
            ...g,
            members: g.members.map((m) => (m.id === targetStudentId ? sourceStudent : m)),
          };
        }
        return g;
      });
    });
  };

  const handleRenameGroup = (groupId: string, newLabel: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, label: newLabel } : g)),
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickImport={() => setActiveTab('roster')}
      />

      <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'picker' && (
          <RandomPickerView
            students={students}
            isSimulatedRoster={isSimulatedRoster}
            allowRepeat={allowRepeat}
            onAllowRepeatChange={setAllowRepeat}
            drawnRecords={drawnRecords}
            onRecordDrawn={handleRecordDrawn}
            onUndoRecord={handleUndoRecord}
            onResetDrawnPool={handleResetDrawnPool}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted((m) => !m)}
            volume={volume}
            onVolumeChange={setVolume}
            onGoToRoster={() => setActiveTab('roster')}
            onLoadSimulatedRoster={handleLoadSimulatedRoster}
          />
        )}

        {activeTab === 'grouping' && (
          <GroupingView
            students={students}
            isSimulatedRoster={isSimulatedRoster}
            groups={groups}
            perGroupSize={perGroupSize}
            remainderStrategy={remainderStrategy}
            onPerGroupSizeChange={setPerGroupSize}
            onRemainderStrategyChange={setRemainderStrategy}
            onGenerateGroups={handleGenerateGroups}
            onSwapStudents={handleSwapStudents}
            onRenameGroup={handleRenameGroup}
            isMuted={isMuted}
            volume={volume}
            onGoToRoster={() => setActiveTab('roster')}
            onLoadSimulatedRoster={handleLoadSimulatedRoster}
          />
        )}

        {activeTab === 'roster' && (
          <RosterPanel
            students={students}
            isSimulatedRoster={isSimulatedRoster}
            onReplaceRoster={handleReplaceRoster}
            onAppendRoster={handleAppendRoster}
            onAddSingleStudent={handleAddSingleStudent}
            onRemoveStudent={handleRemoveStudent}
            onDeduplicate={handleDeduplicate}
            onClearRoster={handleClearRoster}
            onNavigateToFeature={(target) => setActiveTab(target)}
          />
        )}
      </main>
    </div>
  );
}
