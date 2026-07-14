import { useCallback, useMemo, useRef, useState } from 'react';
import './App.css';
import { calculateSheet, formatCurrency, formatPercent, grandTotal } from './calculations';
import { exportMaterialExcel } from './exportExcel';
import { exportMaterialPdf } from './exportPdf';
import {
  exportAllSeparateExcel,
  exportAllSeparatePdf,
  exportCompletePdf,
  exportCompleteWorkbook,
  exportSummaryExcel,
  exportSummaryPdf,
} from './exportSummary';
import { parseExcelFile } from './importExcel';
import type { EntryRow, MaterialSheet, ProjectInfo } from './types';

const SUMMARY_TAB = '__summary__';

const DEFAULT_MATERIALS: Omit<MaterialSheet, 'id' | 'rows'>[] = [
  { name: 'STEEL', unit: 'KG', baseRate: 0, profitPercent: 11, thresholdPercent: 5 },
  { name: 'SAND', unit: 'CFT', baseRate: 0, profitPercent: 11, thresholdPercent: 5 },
  { name: 'CEMENT', unit: 'BAG', baseRate: 0, profitPercent: 11, thresholdPercent: 5 },
  { name: 'CRUSH', unit: 'CFT', baseRate: 0, profitPercent: 11, thresholdPercent: 5 },
  { name: 'BRICKS', unit: 'NO', baseRate: 0, profitPercent: 11, thresholdPercent: 5 },
];

function createId(): string {
  return crypto.randomUUID();
}

function createEmptyRow(): EntryRow {
  return { id: createId(), date: new Date().toISOString().slice(0, 10), quantity: 0, purchasePrice: 0 };
}

function createMaterial(data: Omit<MaterialSheet, 'id' | 'rows'>): MaterialSheet {
  return { ...data, id: createId(), rows: [createEmptyRow()] };
}

function rowsFromImport(imported: Omit<EntryRow, 'id'>[]): EntryRow[] {
  return imported.map((row) => ({ ...row, id: createId() }));
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState('');

  const [project, setProject] = useState<ProjectInfo>({
    title: 'MATERIAL RATE ESCALATION STATEMENT',
    project: '',
    purpose: 'Cost Revision / Rate Inflation',
    dateTill: new Date().toISOString().slice(0, 10),
  });

  const [materials, setMaterials] = useState<MaterialSheet[]>(() =>
    DEFAULT_MATERIALS.map((m) => createMaterial(m))
  );
  const [activeMaterialId, setActiveMaterialId] = useState(materials[0]?.id ?? '');

  const isSummaryView = activeMaterialId === SUMMARY_TAB;
  const activeSheet = materials.find((m) => m.id === activeMaterialId) ?? materials[0];

  const calculatedRows = useMemo(
    () => (activeSheet && !isSummaryView ? calculateSheet(activeSheet) : []),
    [activeSheet, isSummaryView]
  );
  const total = grandTotal(calculatedRows);

  const materialSummaries = useMemo(
    () =>
      materials.map((material) => {
        const rows = calculateSheet(material);
        return {
          material,
          calculatedRows: rows,
          total: grandTotal(rows),
          entryCount: rows.filter((r) => r.quantity > 0 || r.purchasePrice > 0).length,
        };
      }),
    [materials]
  );

  const overallTotal = materialSummaries.reduce((sum, s) => sum + s.total, 0);

  const updateProject = (field: keyof ProjectInfo, value: string) => {
    setProject((prev) => ({ ...prev, [field]: value }));
  };

  const updateMaterial = (field: keyof MaterialSheet, value: string | number) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === activeMaterialId ? { ...m, [field]: value } : m))
    );
  };

  const updateRow = (rowId: string, field: keyof EntryRow, value: string | number) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== activeMaterialId) return m;
        return {
          ...m,
          rows: m.rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
        };
      })
    );
  };

  const addRow = () => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === activeMaterialId ? { ...m, rows: [...m.rows, createEmptyRow()] } : m
      )
    );
  };

  const removeRow = (rowId: string) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== activeMaterialId) return m;
        const rows = m.rows.filter((r) => r.id !== rowId);
        return { ...m, rows: rows.length ? rows : [createEmptyRow()] };
      })
    );
  };

  const addMaterial = () => {
    const name = prompt('Material name (e.g. AGGREGATE):');
    if (!name?.trim()) return;
    const unit = prompt('Unit of measure (e.g. KG, CFT, BAG):') || 'KG';
    const newMaterial = createMaterial({
      name: name.trim().toUpperCase(),
      unit: unit.trim().toUpperCase(),
      baseRate: 0,
      profitPercent: 11,
      thresholdPercent: 5,
    });
    setMaterials((prev) => [...prev, newMaterial]);
    setActiveMaterialId(newMaterial.id);
  };

  const applyImportToMaterial = (
    materialId: string,
    importedRows: Omit<EntryRow, 'id'>[],
    meta?: {
      baseRate?: number;
      profitPercent?: number;
      thresholdPercent?: number;
    }
  ) => {
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== materialId) return m;
        const existingData = m.rows.filter((r) => r.quantity > 0 || r.purchasePrice > 0);
        const newRows = [...existingData, ...rowsFromImport(importedRows)];
        return {
          ...m,
          baseRate: meta?.baseRate ?? m.baseRate,
          profitPercent: meta?.profitPercent ?? m.profitPercent,
          thresholdPercent: meta?.thresholdPercent ?? m.thresholdPercent,
          rows: newRows.length ? newRows : [createEmptyRow()],
        };
      })
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const parsedSheets = await parseExcelFile(file);
      const sheetsWithData = parsedSheets.filter((s) => s.rows.length > 0);

      if (sheetsWithData.length === 0) {
        setImportMessage('No data rows found. Ensure columns: Date, Quantity, Purchase Price.');
        return;
      }

      const firstMeta = sheetsWithData.find((s) => s.project)?.project;
      if (firstMeta) {
        setProject((prev) => ({
          title: firstMeta.title || prev.title,
          project: firstMeta.project || prev.project,
          purpose: firstMeta.purpose || prev.purpose,
          dateTill: firstMeta.dateTill || prev.dateTill,
        }));
      }

      if (isSummaryView || sheetsWithData.length > 1) {
        let importedCount = 0;
        setMaterials((prev) => {
          const updated = [...prev];
          for (const parsed of sheetsWithData) {
            const matchIndex = updated.findIndex(
              (m) => m.name.toUpperCase() === parsed.sheetName.toUpperCase()
            );
            if (matchIndex >= 0) {
              const m = updated[matchIndex];
              const existingData = m.rows.filter((r) => r.quantity > 0 || r.purchasePrice > 0);
              const merged = [...existingData, ...rowsFromImport(parsed.rows)];
              updated[matchIndex] = {
                ...m,
                baseRate: parsed.baseRate ?? m.baseRate,
                profitPercent: parsed.profitPercent ?? m.profitPercent,
                thresholdPercent: parsed.thresholdPercent ?? m.thresholdPercent,
                rows: merged.length ? merged : [createEmptyRow()],
              };
              importedCount += parsed.rows.length;
            } else {
              updated.push({
                id: createId(),
                name: parsed.sheetName.toUpperCase(),
                unit: 'KG',
                baseRate: parsed.baseRate ?? 0,
                profitPercent: parsed.profitPercent ?? 11,
                thresholdPercent: parsed.thresholdPercent ?? 5,
                rows: rowsFromImport(parsed.rows),
              });
              importedCount += parsed.rows.length;
            }
          }
          return updated;
        });
        setImportMessage(`Imported ${importedCount} rows across ${sheetsWithData.length} sheet(s).`);
      } else if (activeSheet) {
        const parsed = sheetsWithData[0];
        applyImportToMaterial(activeSheet.id, parsed.rows, parsed);
        setImportMessage(`Imported ${parsed.rows.length} rows into ${activeSheet.name}.`);
      }
    } catch {
      setImportMessage('Failed to read Excel file. Please check the format.');
    }
  };

  const handleExportPdf = useCallback(() => {
    if (!activeSheet || isSummaryView) return;
    exportMaterialPdf(project, activeSheet, calculatedRows);
  }, [project, activeSheet, calculatedRows, isSummaryView]);

  const handleExportExcel = useCallback(() => {
    if (!activeSheet || isSummaryView) return;
    exportMaterialExcel(project, activeSheet, calculatedRows);
  }, [project, activeSheet, calculatedRows, isSummaryView]);

  if (!activeSheet && !isSummaryView) return null;

  return (
    <div className="app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden-input"
        onChange={handleFileUpload}
      />

      <header className="header">
        <input
          className="title-input"
          value={project.title}
          onChange={(e) => updateProject('title', e.target.value)}
          aria-label="Statement title"
        />
        <div className="project-fields">
          <label>
            Project
            <input
              value={project.project}
              onChange={(e) => updateProject('project', e.target.value)}
              placeholder="e.g. OPF Plaza - WEMS HEIGHTS"
            />
          </label>
          <label>
            Purpose
            <input
              value={project.purpose}
              onChange={(e) => updateProject('purpose', e.target.value)}
            />
          </label>
          <label>
            Date till
            <input
              type="date"
              value={project.dateTill}
              onChange={(e) => updateProject('dateTill', e.target.value)}
            />
          </label>
        </div>
      </header>

      <nav className="material-tabs">
        <button
          type="button"
          className={`tab summary-tab ${isSummaryView ? 'active' : ''}`}
          onClick={() => setActiveMaterialId(SUMMARY_TAB)}
        >
          SUMMARY
        </button>
        {materials.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`tab ${m.id === activeMaterialId ? 'active' : ''}`}
            onClick={() => setActiveMaterialId(m.id)}
          >
            {m.name}
          </button>
        ))}
        <button type="button" className="tab add-tab" onClick={addMaterial}>
          + Add Material
        </button>
      </nav>

      {importMessage && (
        <div className="import-message" role="status">
          {importMessage}
          <button type="button" className="dismiss-btn" onClick={() => setImportMessage('')}>
            ×
          </button>
        </div>
      )}

      {isSummaryView ? (
        <>
          <section className="summary-section">
            <div className="summary-header">
              <h2>All Materials Summary</h2>
              <p>Totals for each material based on current entries and agreed rates.</p>
            </div>
            <div className="table-wrapper summary-table-wrap">
              <table className="data-table summary-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Unit</th>
                    <th>Agreed Rate</th>
                    <th>Entries</th>
                    <th>Total Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materialSummaries.map(({ material, total: matTotal, entryCount, calculatedRows: rows }, index) => (
                    <tr key={material.id} className={index % 2 === 1 ? 'alt' : ''}>
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setActiveMaterialId(material.id)}
                        >
                          {material.name}
                        </button>
                      </td>
                      <td>{material.unit}</td>
                      <td className="calc">{formatCurrency(material.baseRate)}</td>
                      <td>{entryCount}</td>
                      <td className={`calc total-cell ${matTotal > 0 ? 'up' : matTotal < 0 ? 'down' : ''}`}>
                        {formatCurrency(matTotal)}
                      </td>
                      <td className="summary-actions">
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => exportMaterialExcel(project, material, rows)}
                        >
                          Excel
                        </button>
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => exportMaterialPdf(project, material, rows)}
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="grand-label">
                      OVERALL TOTAL
                    </td>
                    <td className={`grand-total ${overallTotal > 0 ? 'up' : overallTotal < 0 ? 'down' : ''}`}>
                      {formatCurrency(overallTotal)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className="actions summary-actions-bar">
            <button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()}>
              Upload Excel
            </button>
            <div className="action-group">
              <span className="action-label">Combined</span>
              <button type="button" className="btn excel" onClick={() => exportCompleteWorkbook(project, materials)}>
                Workbook (Excel)
              </button>
              <button type="button" className="btn primary" onClick={() => exportCompletePdf(project, materials)}>
                Complete (PDF)
              </button>
              <button type="button" className="btn secondary" onClick={() => exportSummaryExcel(project, materials)}>
                Summary (Excel)
              </button>
              <button type="button" className="btn secondary" onClick={() => exportSummaryPdf(project, materials)}>
                Summary (PDF)
              </button>
            </div>
            <div className="action-group">
              <span className="action-label">Separate files</span>
              <button type="button" className="btn excel" onClick={() => exportAllSeparateExcel(project, materials)}>
                All Excel
              </button>
              <button type="button" className="btn primary" onClick={() => exportAllSeparatePdf(project, materials)}>
                All PDF
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <section className="material-config">
            <label>
              Agreed Rate (Base)
              <input
                type="number"
                min="0"
                step="0.01"
                value={activeSheet.baseRate || ''}
                onChange={(e) => updateMaterial('baseRate', parseFloat(e.target.value) || 0)}
                placeholder="Rate as per agreement"
              />
            </label>
            <label>
              Unit
              <input
                value={activeSheet.unit}
                onChange={(e) => updateMaterial('unit', e.target.value.toUpperCase())}
              />
            </label>
            <label>
              Profit %
              <input
                type="number"
                min="0"
                step="0.1"
                value={activeSheet.profitPercent}
                onChange={(e) => updateMaterial('profitPercent', parseFloat(e.target.value) || 0)}
              />
            </label>
            <label>
              Threshold ±%
              <input
                type="number"
                min="0"
                step="0.1"
                value={activeSheet.thresholdPercent}
                onChange={(e) => updateMaterial('thresholdPercent', parseFloat(e.target.value) || 0)}
              />
            </label>
          </section>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S No</th>
                  <th>Date</th>
                  <th>Material</th>
                  <th>U/M</th>
                  <th>Quantity</th>
                  <th>Purchase Price</th>
                  <th>Price + Profit</th>
                  <th>Agreed Rate</th>
                  <th>Increase</th>
                  <th>% Increase</th>
                  <th>±{activeSheet.thresholdPercent}% Diff</th>
                  <th>After {activeSheet.thresholdPercent}%</th>
                  <th>Total Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calculatedRows.map((calc, index) => {
                  const row = activeSheet.rows[index];
                  const isCredit = calc.totalIncreaseAmount < 0;
                  const isCharge = calc.totalIncreaseAmount > 0;

                  return (
                    <tr key={row.id} className={index % 2 === 1 ? 'alt' : ''}>
                      <td>{calc.serialNo}</td>
                      <td>
                        <input
                          type="date"
                          className="cell-input"
                          value={row.date}
                          onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                        />
                      </td>
                      <td>{calc.material}</td>
                      <td>{calc.unit}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="cell-input num"
                          value={row.quantity || ''}
                          onChange={(e) => updateRow(row.id, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="cell-input num"
                          value={row.purchasePrice || ''}
                          onChange={(e) =>
                            updateRow(row.id, 'purchasePrice', parseFloat(e.target.value) || 0)
                          }
                        />
                      </td>
                      <td className="calc">{formatCurrency(calc.purchasePriceWithProfit)}</td>
                      <td className="calc">{formatCurrency(calc.baseRate)}</td>
                      <td className={`calc ${calc.increaseAmount >= 0 ? 'up' : 'down'}`}>
                        {formatCurrency(calc.increaseAmount)}
                      </td>
                      <td className={`calc ${calc.percentIncrease >= 0 ? 'up' : 'down'}`}>
                        {formatPercent(calc.percentIncrease)}
                      </td>
                      <td className="calc">{formatCurrency(calc.thresholdAmount)}</td>
                      <td className={`calc ${isCharge ? 'up' : isCredit ? 'down' : ''}`}>
                        {formatCurrency(calc.escalatedRatePerUnit)}
                      </td>
                      <td className={`calc total-cell ${isCharge ? 'up' : isCredit ? 'down' : ''}`}>
                        {formatCurrency(calc.totalIncreaseAmount)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => removeRow(row.id)}
                          title="Remove row"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={12} className="grand-label">
                    GRAND TOTAL
                  </td>
                  <td className={`grand-total ${total > 0 ? 'up' : total < 0 ? 'down' : ''}`}>
                    {formatCurrency(total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="actions">
            <button type="button" className="btn secondary" onClick={addRow}>
              + Add Row
            </button>
            <button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()}>
              Upload Excel
            </button>
            <button type="button" className="btn excel" onClick={handleExportExcel}>
              Download Excel
            </button>
            <button type="button" className="btn primary" onClick={handleExportPdf}>
              Download PDF
            </button>
          </div>

          <footer className="formula-note">
            <strong>Logic:</strong> If market price change is within ±{activeSheet.thresholdPercent}% of
            the agreed rate, no adjustment. Above +{activeSheet.thresholdPercent}% → client pays extra.
            Below −{activeSheet.thresholdPercent}% → owner refunds the amount beyond the threshold.
            <br />
            <strong>Import:</strong> Upload an Excel file with Date, Quantity, and Purchase Price columns.
            Rows are added to this material automatically.
          </footer>
        </>
      )}
    </div>
  );
}
