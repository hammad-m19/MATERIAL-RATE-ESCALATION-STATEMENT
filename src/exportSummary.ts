import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateSheet, formatCurrency, grandTotal } from './calculations';
import { buildMaterialAoa, buildSummaryAoa, EXCEL_COL_WIDTHS, type MaterialSummaryRow } from './exportBuild';
import { exportMaterialExcel } from './exportExcel';
import { exportMaterialPdf } from './exportPdf';
import type { MaterialSheet, ProjectInfo } from './types';

function buildSummaries(materials: MaterialSheet[]): MaterialSummaryRow[] {
  return materials.map((material) => {
    const calculatedRows = calculateSheet(material);
    return { material, calculatedRows, total: grandTotal(calculatedRows) };
  });
}

function aoaToWorksheet(data: (string | number)[][], mergeTitle = false): XLSX.WorkSheet {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  if (mergeTitle) {
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
    worksheet['!cols'] = EXCEL_COL_WIDTHS;
  } else {
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    worksheet['!cols'] = [{ wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];
  }
  return worksheet;
}

export function exportSummaryExcel(project: ProjectInfo, materials: MaterialSheet[]): void {
  const summaries = buildSummaries(materials);
  const worksheet = aoaToWorksheet(buildSummaryAoa(project, summaries));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SUMMARY');
  XLSX.writeFile(workbook, 'escalation_summary.xlsx');
}

export function exportCompleteWorkbook(project: ProjectInfo, materials: MaterialSheet[]): void {
  const summaries = buildSummaries(materials);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    aoaToWorksheet(buildSummaryAoa(project, summaries)),
    'SUMMARY'
  );

  for (const { material, calculatedRows } of summaries) {
    XLSX.utils.book_append_sheet(
      workbook,
      aoaToWorksheet(buildMaterialAoa(project, material, calculatedRows), true),
      material.name.slice(0, 31)
    );
  }

  XLSX.writeFile(workbook, 'escalation_complete_workbook.xlsx');
}

export function exportSummaryPdf(project: ProjectInfo, materials: MaterialSheet[]): void {
  const summaries = buildSummaries(materials);
  const overallTotal = summaries.reduce((sum, s) => sum + s.total, 0);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(project.title || 'MATERIAL RATE ESCALATION STATEMENT', 105, 18, { align: 'center' });
  doc.setFontSize(11);
  doc.text('SUMMARY', 105, 26, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.project}`, 14, 36);
  doc.text(`Purpose: ${project.purpose}`, 14, 42);
  doc.text(`Date till: ${project.dateTill}`, 14, 48);

  autoTable(doc, {
    startY: 56,
    head: [['Material', 'Unit', 'Agreed Rate', 'Entries', 'Total Amount']],
    body: summaries.map(({ material, calculatedRows, total }) => [
      material.name,
      material.unit,
      formatCurrency(material.baseRate),
      calculatedRows.length,
      formatCurrency(total),
    ]),
    foot: [[
      { content: 'OVERALL TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatCurrency(overallTotal), styles: { fontStyle: 'bold' } },
    ]],
    theme: 'grid',
    headStyles: { fillColor: [46, 125, 50], textColor: 255, halign: 'center' },
    footStyles: { fillColor: [232, 245, 233] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  doc.save('escalation_summary.pdf');
}

export function exportCompletePdf(project: ProjectInfo, materials: MaterialSheet[]): void {
  const summaries = buildSummaries(materials);
  const overallTotal = summaries.reduce((sum, s) => sum + s.total, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(project.title || 'MATERIAL RATE ESCALATION STATEMENT', 148, 15, { align: 'center' });
  doc.setFontSize(12);
  doc.text('SUMMARY', 148, 22, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.project}`, 14, 30);
  doc.text(`Purpose: ${project.purpose}`, 14, 36);
  doc.text(`Date till: ${project.dateTill}`, 14, 42);

  autoTable(doc, {
    startY: 48,
    head: [['Material', 'Unit', 'Agreed Rate', 'Entries', 'Total Amount']],
    body: summaries.map(({ material, calculatedRows, total }) => [
      material.name,
      material.unit,
      formatCurrency(material.baseRate),
      calculatedRows.length,
      formatCurrency(total),
    ]),
    foot: [[
      { content: 'OVERALL TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatCurrency(overallTotal), styles: { fontStyle: 'bold' } },
    ]],
    theme: 'grid',
    headStyles: { fillColor: [46, 125, 50], textColor: 255 },
    footStyles: { fillColor: [232, 245, 233] },
    margin: { left: 14, right: 14 },
  });

  for (const { material, calculatedRows } of summaries) {
    doc.addPage('a4', 'landscape');
    const total = grandTotal(calculatedRows);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(material.name, 148, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Agreed Rate: ${formatCurrency(material.baseRate)} | Unit: ${material.unit}`, 14, 24);

    autoTable(doc, {
      startY: 30,
      head: [[
        'S No', 'Date', 'Qty', 'Purchase Price', 'Price + Profit', 'Agreed Rate',
        'Increase', '% Inc', '±5% Diff', 'After 5%', 'Total',
      ]],
      body: calculatedRows.map((row) => [
        row.serialNo,
        row.date,
        formatCurrency(row.quantity, 0),
        formatCurrency(row.purchasePrice),
        formatCurrency(row.purchasePriceWithProfit),
        formatCurrency(row.baseRate),
        formatCurrency(row.increaseAmount),
        `${row.percentIncrease.toFixed(2)}%`,
        formatCurrency(row.thresholdAmount),
        formatCurrency(row.escalatedRatePerUnit),
        formatCurrency(row.totalIncreaseAmount),
      ]),
      foot: [[
        { content: 'GRAND TOTAL', colSpan: 10, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(total), styles: { fontStyle: 'bold' } },
      ]],
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50], textColor: 255, fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save('escalation_complete.pdf');
}

export function exportAllSeparateExcel(project: ProjectInfo, materials: MaterialSheet[]): void {
  for (const material of materials) {
    exportMaterialExcel(project, material, calculateSheet(material));
  }
}

export function exportAllSeparatePdf(project: ProjectInfo, materials: MaterialSheet[]): void {
  for (const material of materials) {
    exportMaterialPdf(project, material, calculateSheet(material));
  }
}
