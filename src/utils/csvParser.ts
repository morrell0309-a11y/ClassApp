import { CsvPreviewData, Student } from '../types/classroom';

export const SAMPLE_STUDENT_NAMES: string[] = [
  '陳柏翰',
  '林欣妤',
  '黃宇辰',
  '張語彤',
  '李承恩',
  '王品妍',
  '吳宗翰',
  '蔡宜臻',
  '劉子軒',
  '楊詠晴',
  '許冠宇',
  '鄭羽希',
  '謝秉樺',
  '郭芷瑄',
  '洪楷翔',
  '曾詩涵',
  '邱柏叡',
  '廖晨希',
  '賴奕安',
  '徐若寧',
  '周宥廷',
  '葉思穎',
  '莊博鈞',
  '蘇苡甄',
];

export const SIMULATED_PASTE_TEXT = [
  '陳柏翰',
  '林欣妤',
  '黃宇辰',
  '張語彤',
  '陳柏翰',
  '李承恩',
  '王品妍',
  '林欣妤',
  '吳宗翰',
  '蔡宜臻',
].join('\n');

export function deduplicateNames(names: string[]): { unique: string[]; removedCount: number } {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(name);
    }
  }
  return {
    unique,
    removedCount: names.filter((n) => n.trim().length > 0).length - unique.length,
  };
}

export function createStudentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `stu_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createStudentsFromNames(names: string[]): Student[] {
  return names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((name) => ({
      id: createStudentId(),
      name,
    }));
}

export function decodeTextBuffer(buffer: ArrayBuffer): string {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8.replace(/^\uFEFF/, '');
  } catch {
    try {
      const big5 = new TextDecoder('big5').decode(buffer);
      return big5.replace(/^\uFEFF/, '');
    } catch {
      return new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    }
  }
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const NAME_HEADER_KEYWORDS = ['姓名', '學生姓名', '名字', '學生', 'name', 'student', 'full name', 'fullname'];
const HEADER_KEYWORDS = [
  ...NAME_HEADER_KEYWORDS,
  '座號',
  '學號',
  '班級',
  '編號',
  'id',
  'no',
  'number',
  'class',
  'email',
  '性別',
];

export function parseCsvPreview(rawText: string, fileName: string): CsvPreviewData {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      fileName,
      headers: [],
      rows: [],
      detectedNameColumn: 0,
      hasHeader: false,
    };
  }

  // If lines look tab-separated and have no commas, support TSV smoothly
  const usesTab = !lines[0].includes(',') && lines[0].includes('\t');
  const parsedRows = lines.map((line) =>
    usesTab ? line.split('\t').map((cell) => cell.trim()) : parseCsvLine(line),
  );

  const maxCols = Math.max(...parsedRows.map((r) => r.length));
  const normalizedRows = parsedRows.map((r) => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push('');
    return padded;
  });

  const firstRow = normalizedRows[0];
  const hasHeader =
    normalizedRows.length > 1 &&
    firstRow.some((cell) => HEADER_KEYWORDS.includes(cell.toLowerCase().trim()));

  const headers = hasHeader
    ? firstRow.map((h, i) => h || `第 ${i + 1} 欄`)
    : firstRow.map((_, i) => `第 ${i + 1} 欄`);

  const dataRows = hasHeader ? normalizedRows.slice(1) : normalizedRows;

  // Detect best column for student names
  let detectedNameColumn = 0;
  if (hasHeader) {
    const headerMatch = firstRow.findIndex((cell) =>
      NAME_HEADER_KEYWORDS.some((kw) => cell.toLowerCase().includes(kw)),
    );
    if (headerMatch !== -1) {
      detectedNameColumn = headerMatch;
    } else {
      // Pick first column that isn't purely numeric
      const nonNumericCol = firstRow.findIndex((_, colIdx) => {
        const sample = dataRows.slice(0, 5).map((r) => r[colIdx]).filter(Boolean);
        return sample.some((v) => !/^\d+$/.test(v));
      });
      if (nonNumericCol !== -1) detectedNameColumn = nonNumericCol;
    }
  } else if (maxCols > 1) {
    const nonNumericCol = firstRow.findIndex((_, colIdx) => {
      const sample = dataRows.slice(0, 5).map((r) => r[colIdx]).filter(Boolean);
      return sample.some((v) => !/^\d+$/.test(v));
    });
    if (nonNumericCol !== -1) detectedNameColumn = nonNumericCol;
  }

  return {
    fileName,
    headers,
    rows: dataRows,
    detectedNameColumn,
    hasHeader,
  };
}

export function parsePastedNames(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/[\n,、;；\t]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
