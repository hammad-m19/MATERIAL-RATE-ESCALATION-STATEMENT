import type { CalculatedRow, EntryRow, MaterialSheet } from './types';

export function calculateRow(
  row: EntryRow,
  sheet: MaterialSheet,
  serialNo: number
): CalculatedRow {
  const { quantity, purchasePrice, date } = row;
  const { name, unit, profitPercent, thresholdPercent } = sheet;

  const baseRate = row.baseRate !== undefined && row.baseRate > 0 ? row.baseRate : sheet.baseRate;

  const purchasePriceWithProfit = purchasePrice * (1 + profitPercent / 100);
  const increaseAmount = purchasePriceWithProfit - baseRate;
  const percentIncrease = baseRate > 0 ? (increaseAmount / baseRate) * 100 : 0;
  const thresholdAmount = baseRate * (thresholdPercent / 100);

  let escalatedRatePerUnit = 0;
  if (increaseAmount > thresholdAmount) {
    escalatedRatePerUnit = increaseAmount - thresholdAmount;
  } else if (increaseAmount < -thresholdAmount) {
    escalatedRatePerUnit = increaseAmount + thresholdAmount;
  }

  const totalIncreaseAmount = escalatedRatePerUnit * quantity;

  return {
    serialNo,
    date,
    material: name,
    unit,
    quantity,
    purchasePrice,
    purchasePriceWithProfit,
    baseRate,
    increaseAmount,
    percentIncrease,
    thresholdAmount,
    escalatedRatePerUnit,
    totalIncreaseAmount,
  };
}

export function calculateSheet(sheet: MaterialSheet): CalculatedRow[] {
  return sheet.rows.map((row, index) => calculateRow(row, sheet, index + 1));
}

export function grandTotal(rows: CalculatedRow[]): number {
  return rows.reduce((sum, row) => sum + row.totalIncreaseAmount, 0);
}

export function formatCurrency(value: number, decimals = 2): string {
  return value.toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}
