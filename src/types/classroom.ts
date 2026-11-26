export type AppTab = 'picker' | 'grouping' | 'roster';

export interface Student {
  id: string;
  name: string;
}

export interface DrawRecord {
  id: string;
  studentId: string;
  name: string;
  round: number;
  timestamp: number;
}

export type RemainderStrategy = 'distribute' | 'separate';

export type AnimationSpeed = 'normal' | 'fast';

export interface GroupTheme {
  id: string;
  name: string;
  barBg: string;
  softBg: string;
  border: string;
  text: string;
  avatarBg: string;
  avatarText: string;
  ring: string;
}

export interface StudentGroup {
  id: string;
  index: number;
  label: string;
  members: Student[];
  theme: GroupTheme;
}

export interface CsvPreviewData {
  fileName: string;
  headers: string[];
  rows: string[][];
  detectedNameColumn: number;
  hasHeader: boolean;
}
