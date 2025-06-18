import fetch from 'node-fetch';
import { readCache, writeCache } from '../cache.js';
import { FINMIND_BASE_URL } from '../constants/index.js';

const BASE_URL = `${FINMIND_BASE_URL}/data`;

export async function fetchFinMind(
  dataset: string,
  params: Record<string, string> = {},
  offline = false
): Promise<any[]> {
  const key = `${dataset}_${JSON.stringify(params)}`;
  const cached = await readCache(dataset, key);
  if (cached) return cached;
  if (offline) throw new Error('Offline and no cache');

  const url = new URL(BASE_URL);
  url.searchParams.set('dataset', dataset);
  if (process.env.FINMIND_TOKEN) {
    url.searchParams.set('token', process.env.FINMIND_TOKEN);
  }
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FinMind ${res.status}`);
  const json = (await res.json()) as { status: number; data: any[]; msg: string };
  if (json.status !== 200) throw new Error(json.msg);
  await writeCache(dataset, key, json.data);
  return json.data;
}
