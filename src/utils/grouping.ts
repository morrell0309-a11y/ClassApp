import { GroupTheme, RemainderStrategy, Student, StudentGroup } from '../types/classroom';

export const GROUP_THEMES: GroupTheme[] = [
  {
    id: 'cobalt',
    name: '鈷藍',
    barBg: 'bg-blue-600',
    softBg: 'bg-blue-50/70',
    border: 'border-blue-200',
    text: 'text-blue-700',
    avatarBg: 'bg-blue-100',
    avatarText: 'text-blue-800',
    ring: 'ring-blue-500',
  },
  {
    id: 'emerald',
    name: '翠綠',
    barBg: 'bg-emerald-600',
    softBg: 'bg-emerald-50/70',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    avatarBg: 'bg-emerald-100',
    avatarText: 'text-emerald-800',
    ring: 'ring-emerald-500',
  },
  {
    id: 'amber',
    name: '琥珀',
    barBg: 'bg-amber-500',
    softBg: 'bg-amber-50/70',
    border: 'border-amber-200',
    text: 'text-amber-800',
    avatarBg: 'bg-amber-100',
    avatarText: 'text-amber-900',
    ring: 'ring-amber-500',
  },
  {
    id: 'violet',
    name: '靛紫',
    barBg: 'bg-violet-600',
    softBg: 'bg-violet-50/70',
    border: 'border-violet-200',
    text: 'text-violet-700',
    avatarBg: 'bg-violet-100',
    avatarText: 'text-violet-800',
    ring: 'ring-violet-500',
  },
  {
    id: 'rose',
    name: '珊瑚紅',
    barBg: 'bg-rose-600',
    softBg: 'bg-rose-50/70',
    border: 'border-rose-200',
    text: 'text-rose-700',
    avatarBg: 'bg-rose-100',
    avatarText: 'text-rose-800',
    ring: 'ring-rose-500',
  },
  {
    id: 'teal',
    name: '青綠',
    barBg: 'bg-teal-600',
    softBg: 'bg-teal-50/70',
    border: 'border-teal-200',
    text: 'text-teal-700',
    avatarBg: 'bg-teal-100',
    avatarText: 'text-teal-800',
    ring: 'ring-teal-500',
  },
  {
    id: 'indigo',
    name: '群青',
    barBg: 'bg-indigo-600',
    softBg: 'bg-indigo-50/70',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    avatarBg: 'bg-indigo-100',
    avatarText: 'text-indigo-800',
    ring: 'ring-indigo-500',
  },
  {
    id: 'orange',
    name: '暖橘',
    barBg: 'bg-orange-500',
    softBg: 'bg-orange-50/70',
    border: 'border-orange-200',
    text: 'text-orange-800',
    avatarBg: 'bg-orange-100',
    avatarText: 'text-orange-900',
    ring: 'ring-orange-500',
  },
];

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createGroups(
  students: Student[],
  perGroupSize: number,
  strategy: RemainderStrategy,
): StudentGroup[] {
  if (students.length === 0) return [];

  const safeSize = Math.max(1, Math.min(perGroupSize, students.length));
  const shuffled = shuffleArray(students);
  const buckets: Student[][] = [];

  if (strategy === 'separate' || shuffled.length <= safeSize) {
    for (let i = 0; i < shuffled.length; i += safeSize) {
      buckets.push(shuffled.slice(i, i + safeSize));
    }
  } else {
    // Distribute remainder evenly across groups so no tiny leftover group forms
    const numGroups = Math.max(1, Math.floor(shuffled.length / safeSize));
    for (let g = 0; g < numGroups; g++) {
      buckets.push([]);
    }
    shuffled.forEach((student, idx) => {
      buckets[idx % numGroups].push(student);
    });
  }

  return buckets.map((members, index) => ({
    id: `group_${index + 1}_${Date.now()}`,
    index: index + 1,
    label: `第 ${index + 1} 組`,
    members,
    theme: GROUP_THEMES[index % GROUP_THEMES.length],
  }));
}

export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // For CJK names, last 1-2 characters or first character looks very natural; first char is crisp and recognizable
  return trimmed.slice(0, 1).toUpperCase();
}
