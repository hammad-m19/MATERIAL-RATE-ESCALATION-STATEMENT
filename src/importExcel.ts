import * as XLSX from 'xlsx';
import type { EntryRow, ProjectInfo } from './types';

export interface ParsedSheetData {
  sheetName: string;
  project?: Partial<ProjectInfo>;
  baseRate?: number;
  profitPercent?: number;
  thresholdPercent?: number;
  rows: Omit<EntryRow, 'id'>[];
}

function cellStr(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

function parseDate(value: unknown): string {
  if (value == null || value === '') return new Date().toISOString().slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const joined = row.map(cellStr).join(' ').toLowerCase();
    if (
      joined.includes('date') &&
      (joined.includes('quantity') || joined.includes('qty')) &&
      joined.includes('purchase')
    ) {
      return i;
    }
  }
  return -1;
}

function getColumnIndex(headers: unknown[], ...names: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = cellStr(headers[i]).toLowerCase();
    for (const name of names) {
      if (h.includes(name)) return i;
    }
  }
  return -1;
}

function parseMetadata(rows: unknown[][], headerRowIndex: number): Partial<ParsedSheetData> {
  const meta: Partial<ParsedSheetData> = {};
  const project: Partial<ProjectInfo> = {};

  for (let i = 0; i < headerRowIndex; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const key = cellStr(row[0]).toLowerCase();
    const val = row[1];
    if (key.includes('project')) project.project = cellStr(val);
    else if (key.includes('purpose')) project.purpose = cellStr(val);
    else if (key.includes('date till')) project.dateTill = parseDate(val);
    else if (key === 'material') meta.sheetName = cellStr(val).toUpperCase();
    else if (key.includes('agreed rate')) meta.baseRate = parseNumber(val);
    else if (key.includes('profit')) meta.profitPercent = parseNumber(val);
    else if (key.includes('threshold')) meta.thresholdPercent = parseNumber(val);
    else if (i === 0 && !key && cellStr(val) === '' && cellStr(row[0])) {
      project.title = cellStr(row[0]);
    }
  }

  if (Object.keys(project).length) meta.project = project;
  return meta;
}

export function parseWorksheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedSheetData {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];
  const headerRowIndex = findHeaderRow(rows);

  if (headerRowIndex === -1) {
    return { sheetName: sheetName.toUpperCase(), rows: [] };
  }

  const meta = parseMetadata(rows, headerRowIndex);
  const headers = rows[headerRowIndex];
  const dateCol = getColumnIndex(headers, 'date');
  const qtyCol = getColumnIndex(headers, 'quantity', 'qty');
  const priceCol = getColumnIndex(headers, 'purchase price', 'purchase');

  const parsedRows: Omit<EntryRow, 'id'>[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => cellStr(c) === '')) continue;

    const label = row.map(cellStr).join(' ').toLowerCase();
    if (label.includes('grand total')) break;

    const quantity = qtyCol >= 0 ? parseNumber(row[qtyCol]) : 0;
    const purchasePrice = priceCol >= 0 ? parseNumber(row[priceCol]) : 0;
    const date = dateCol >= 0 ? parseDate(row[dateCol]) : new Date().toISOString().slice(0, 10);

    if (quantity === 0 && purchasePrice === 0) continue;

    parsedRows.push({ date, quantity, purchasePrice });
  }

  return {
    sheetName: meta.sheetName || sheetName.toUpperCase(),
    ...meta,
    rows: parsedRows,
  };
}

export async function parseExcelFile(file: File): Promise<ParsedSheetData[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return workbook.SheetNames.map((name) => parseWorksheet(workbook.Sheets[name], name));
}
