import { BACKEND_URL } from '../constants';

export type PredictionStatus =
  | 'starting'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface PredictionResponse {
  id: string;
  status: PredictionStatus;
  output?: string | string[] | null;
  error?: string | null;
}

export interface GenerationOptions {
  promptSuffix?: string;
  strengthRatio?: number;
}

export async function startGeneration(
  imageBase64: string,
  style: string,
  mimeType: string,
  options: GenerationOptions = {}
): Promise<PredictionResponse> {
  const res = await fetch(`${BACKEND_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      style,
      mimeType,
      promptSuffix: options.promptSuffix || '',
      strengthRatio: options.strengthRatio ?? 20,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function checkStatus(id: string): Promise<PredictionResponse> {
  const res = await fetch(`${BACKEND_URL}/api/status?id=${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function removeBg(imageUrl: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/removebg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error ?? 'Unknown error'}`);
  return data.url;
}
