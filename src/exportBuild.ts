import type { CalculatedRow, MaterialSheet, ProjectInfo } from './types';
import { grandTotal } from './calculations';

export interface MaterialSummaryRow {
  material: MaterialSheet;
  calculatedRows: CalculatedRow[];
  total: number;
}

export function buildMaterialAoa(
  project: ProjectInfo,
  sheet: MaterialSheet,
  calculatedRows: CalculatedRow[]
): (string | number)[][] {
  const total = grandTotal(calculatedRows);
  const thresholdLabel = `±${sheet.thresholdPercent}% Diff`;
  const afterLabel = `After ${sheet.thresholdPercent}%`;

  const headerRows: (string | number)[][] = [
    [project.title || 'MATERIAL RATE ESCALATION STATEMENT'],
    [],
    ['Project', project.project],
    ['Purpose', project.purpose],
    ['Date till', project.dateTill],
    ['Material', sheet.name],
    ['Agreed Rate', sheet.baseRate],
    ['Profit %', sheet.profitPercent],
    ['Threshold ±%', sheet.thresholdPercent],
    [],
  ];

  const columnHeaders = [
    'S No',
    'Date',
    'Material',
    'U/M',
    'Quantity',
    'Purchase Price',
    'Price + Profit',
    'Agreed Rate',
    'Increase',
    '% Increase',
    thresholdLabel,
    afterLabel,
    'Total Amount',
  ];

  const dataRows: (string | number)[][] = calculatedRows.map((row) => [
    row.serialNo,
    row.date,
    row.material,
    row.unit,
    row.quantity,
    row.purchasePrice,
    row.purchasePriceWithProfit,
    row.baseRate,
    row.increaseAmount,
    row.percentIncrease,
    row.thresholdAmount,
    row.escalatedRatePerUnit,
    row.totalIncreaseAmount,
  ]);

  const footerRow: (string | number)[] = [
    '', '', '', '', '', '', '', '', '', '', '',
    'GRAND TOTAL',
    total,
  ];

  return [...headerRows, columnHeaders, ...dataRows, footerRow];
}

export function buildSummaryAoa(
  project: ProjectInfo,
  summaries: MaterialSummaryRow[]
): (string | number)[][] {
  const overallTotal = summaries.reduce((sum, s) => sum + s.total, 0);

  return [
    [project.title || 'MATERIAL RATE ESCALATION STATEMENT — SUMMARY'],
    [],
    ['Project', project.project],
    ['Purpose', project.purpose],
    ['Date till', project.dateTill],
    [],
    ['Material', 'Unit', 'Agreed Rate', 'Entries', 'Total Amount'],
    ...summaries.map(({ material, calculatedRows, total }) => [
      material.name,
      material.unit,
      material.baseRate,
      calculatedRows.length,
      total,
    ]),
    [],
    ['', '', '', 'OVERALL TOTAL', overallTotal],
  ];
}

export const EXCEL_COL_WIDTHS = [
  { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 6 }, { wch: 10 },
  { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  { wch: 14 }, { wch: 14 }, { wch: 14 },
];
