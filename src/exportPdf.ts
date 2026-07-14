import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CalculatedRow, MaterialSheet, ProjectInfo } from './types';
import { formatCurrency, formatPercent, grandTotal } from './calculations';

export function exportMaterialPdf(
  project: ProjectInfo,
  sheet: MaterialSheet,
  calculatedRows: CalculatedRow[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const total = grandTotal(calculatedRows);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(project.title || 'MATERIAL RATE ESCALATION STATEMENT', 148, 15, {
    align: 'center',
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.project}`, 14, 25);
  doc.text(`Purpose: ${project.purpose}`, 14, 31);
  doc.text(`Date till: ${project.dateTill}`, 14, 37);
  doc.text(`Material: ${sheet.name}`, 200, 25, { align: 'right' });
  doc.text(
    `Profit: ${sheet.profitPercent}% | Threshold: ±${sheet.thresholdPercent}%`,
    200,
    31,
    { align: 'right' }
  );

  autoTable(doc, {
    startY: 44,
    head: [[
      'S No',
      'Date',
      'Material',
      'U/M',
      'Qty',
      'Purchase Price',
      'Price + Profit',
      'Agreed Rate',
      'Increase',
      '% Increase',
      '±5% Diff',
      'After 5%',
      'Total Amount',
    ]],
    body: calculatedRows.map((row) => [
      row.serialNo,
      row.date,
      row.material,
      row.unit,
      formatCurrency(row.quantity, 0),
      formatCurrency(row.purchasePrice),
      formatCurrency(row.purchasePriceWithProfit),
      formatCurrency(row.baseRate),
      formatCurrency(row.increaseAmount),
      formatPercent(row.percentIncrease),
      formatCurrency(row.thresholdAmount),
      formatCurrency(row.escalatedRatePerUnit),
      formatCurrency(row.totalIncreaseAmount),
    ]),
    foot: [[
      { content: 'GRAND TOTAL', colSpan: 12, styles: { halign: 'right', fontStyle: 'bold' } },
      { content: formatCurrency(total), styles: { fontStyle: 'bold' } },
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: [46, 125, 50],
      textColor: 255,
      fontSize: 7,
      halign: 'center',
    },
    bodyStyles: { fontSize: 7, halign: 'center' },
    footStyles: { fillColor: [232, 245, 233], fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 18 },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
      11: { halign: 'right' },
      12: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const safeName = sheet.name.replace(/\s+/g, '_').toLowerCase();
  doc.save(`${safeName}_escalation_statement.pdf`);
}
