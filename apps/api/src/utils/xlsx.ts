import * as XLSX from 'xlsx';

export interface SheetSpec<T> {
  sheetName: string;
  headers: { key: keyof T; label: string }[];
}

export function buildWorkbook<T>(spec: SheetSpec<T>, rows: T[]): XLSX.WorkBook {
  const aoa: any[][] = [spec.headers.map(h => h.label)];
  for (const row of rows) {
    aoa.push(spec.headers.map(h => (row[h.key] as any) ?? ''));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb: XLSX.WorkBook = { SheetNames: [spec.sheetName], Sheets: { [spec.sheetName]: ws } };
  return wb;
}

export function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function parseSheet<T = any>(fileBuffer: Buffer): { rows: T[]; errors: string[] } {
  try {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    const json = XLSX.utils.sheet_to_json<T>(ws, { defval: '' });
    return { rows: json, errors: [] };
  } catch (e: any) {
    return { rows: [], errors: [e.message || 'Failed to parse workbook'] };
  }
}

export function buildTemplate(headers: string[], sheetName: string): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb: XLSX.WorkBook = { SheetNames: [sheetName], Sheets: { [sheetName]: ws } };
  return workbookToBuffer(wb);
}
