import * as XLSX from 'xlsx';
import type { CalculatedRow, MaterialSheet, ProjectInfo } from './types';
import { buildMaterialAoa, EXCEL_COL_WIDTHS } from './exportBuild';

export function exportMaterialExcel(
  project: ProjectInfo,
  sheet: MaterialSheet,
  calculatedRows: CalculatedRow[]
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(buildMaterialAoa(project, sheet, calculatedRows));
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
  worksheet['!cols'] = EXCEL_COL_WIDTHS;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));

  const safeName = sheet.name.replace(/\s+/g, '_').toLowerCase();
  XLSX.writeFile(workbook, `${safeName}_escalation_statement.xlsx`);
}
