// Veloura Manager V2 — Google Sheets backend client
// Replaces the Supabase client. Talks to the deployed Apps Script Web App
// (code.gs) which exposes a JSON API via doGet/doPost. All requests use GET
// with query parameters so the browser never sends a CORS preflight (Apps
// Script web apps only return Access-Control-Allow-Origin on simple GETs).
// The frontend only ever talks to storage through this module and the service layer.

const apiUrl = import.meta.env.VITE_SHEETS_API_URL;
const apiKey = import.meta.env.VITE_SHEETS_API_KEY;

if (!apiUrl) {
  throw new Error('Missing Sheets API URL. Check .env for VITE_SHEETS_API_URL.');
}

// Generic request helper. Everything is a GET; complex params (payloads) are
// JSON-encoded into a single `params` query string.
async function request(action: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(apiUrl);
  url.searchParams.set('action', action);
  if (apiKey) url.searchParams.set('key', apiKey);
  if (Object.keys(params).length > 0) {
    // JSON-encode the params object so nested payloads survive the query string.
    url.searchParams.set('params', JSON.stringify(params));
  }

  const res = await fetch(url.toString(), { method: 'GET' });
  return unwrap(await res.json());
}

function unwrap(payload: any): any {
  if (payload && payload.success === false) {
    throw new Error(payload.message || 'Sheets API error');
  }
  return payload && 'data' in payload ? payload.data : payload;
}

// ---------- Generic CRUD passthroughs ----------

export function sheetsList(sheet: string): Promise<any[]> {
  return request('list', { sheet });
}

export function sheetsGet(sheet: string, id: string): Promise<any> {
  return request('get', { sheet, id });
}

export function sheetsCreate(sheet: string, payload: Record<string, any>): Promise<any> {
  return request('create', { sheet, payload });
}

export function sheetsUpdate(sheet: string, id: string, payload: Record<string, any>): Promise<any> {
  return request('update', { sheet, id, payload });
}

export function sheetsDelete(sheet: string, id: string): Promise<boolean> {
  return request('delete', { sheet, id });
}

// ---------- Business actions ----------

export function sheetsAction(action: string, params: Record<string, any> = {}): Promise<any> {
  return request(action, params);
}
