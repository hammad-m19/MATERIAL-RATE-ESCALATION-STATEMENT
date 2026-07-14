# Material Rate Escalation Calculator

A web tool to calculate material price escalations with a ±5% threshold — matching construction contract logic where small price changes are ignored, but changes beyond 5% trigger client charges or owner refunds.

## How it works

For each purchase entry:

1. **Purchase price + profit** = purchase price × (1 + profit%)
2. **Increase amount** = price with profit − agreed base rate
3. **Threshold** = base rate × threshold% (default 5%)
4. **Escalated rate per unit**:
   - If increase > threshold → client pays (increase − threshold)
   - If increase < −threshold → owner refunds (increase + threshold)
   - Otherwise → no adjustment (0)
5. **Total amount** = escalated rate × quantity

## Features

- Multiple materials (Steel, Sand, Cement, Crush, Bricks) with tabs
- Add custom materials
- Row-by-row calculations with grand total
- Download statement as PDF or Excel (.xlsx)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
```
