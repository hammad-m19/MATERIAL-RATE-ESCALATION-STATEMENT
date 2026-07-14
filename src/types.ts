export interface EntryRow {
  id: string;
  date: string;
  quantity: number;
  purchasePrice: number;
  baseRate?: number;
}

export interface MaterialSheet {
  id: string;
  name: string;
  unit: string;
  baseRate: number;
  profitPercent: number;
  thresholdPercent: number;
  rows: EntryRow[];
}

export interface ProjectInfo {
  title: string;
  project: string;
  purpose: string;
  dateTill: string;
}

export interface CalculatedRow {
  serialNo: number;
  date: string;
  material: string;
  unit: string;
  quantity: number;
  purchasePrice: number;
  purchasePriceWithProfit: number;
  baseRate: number;
  increaseAmount: number;
  percentIncrease: number;
  thresholdAmount: number;
  escalatedRatePerUnit: number;
  totalIncreaseAmount: number;
}
