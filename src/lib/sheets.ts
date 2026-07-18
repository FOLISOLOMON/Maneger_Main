// Veloura Manager V2 — Google Sheets backend client
// Replaces the Supabase client. Talks to the deployed Apps Script Web App
// (code.gs) which exposes a JSON API via doGet/doPost. All requests use GET
// with query parameters so the browser never sends a CORS preflight (Apps
// Script web apps only return Access-Control-Allow-Origin on simple GETs).
// The frontend only ever talks to storage through this module and the service layer.

import type { ApiRecord } from '../types';

const apiUrl = import.meta.env.VITE_SHEETS_API_URL;
const apiKey = import.meta.env.VITE_SHEETS_API_KEY;

if (!apiUrl) {
  throw new Error('Missing Sheets API URL. Check .env for VITE_SHEETS_API_URL.');
}

// Generic request helper. Everything is a GET; complex params (payloads) are
// JSON-encoded into a single `params` query string. The Sheets backend returns
// arbitrary JSON, so the raw result is `unknown` until the service layer (api.ts)
// casts it to a concrete domain type.
async function request(action: string, params: ApiRecord = {}): Promise<unknown> {
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

function unwrap(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && (payload as ApiRecord).success === false) {
    throw new Error(String((payload as ApiRecord).message ?? 'Sheets API error'));
  }
  return payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in (payload as ApiRecord)
    ? (payload as ApiRecord).data
    : payload;
}

// ---------- Generic CRUD passthroughs ----------

// The raw responses are loosely typed JSON; the service layer casts them.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function sheetsList(sheet: string): Promise<any[]> {
  return request('list', { sheet }) as Promise<any[]>;
}

export function sheetsGet(sheet: string, id: string): Promise<any> {
  return request('get', { sheet, id }) as Promise<any>;
}

export function sheetsCreate(sheet: string, payload: ApiRecord): Promise<any> {
  return request('create', { sheet, payload }) as Promise<any>;
}

export function sheetsUpdate(sheet: string, id: string, payload: ApiRecord): Promise<any> {
  return request('update', { sheet, id, payload }) as Promise<any>;
}

export function sheetsDelete(sheet: string, id: string): Promise<boolean> {
  return request('delete', { sheet, id }) as Promise<boolean>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------- Business actions ----------

export function sheetsAction(action: string, params: ApiRecord = {}): Promise<unknown> {
  return request(action, params);
}
