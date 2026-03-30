import { useState, useEffect, useRef, useCallback } from 'react';
import { startGeneration, checkStatus, PredictionStatus, GenerationOptions } from '../services/api';
import { getCached, setCached, makeCacheKey } from '../services/cache';

export type GenerationStatus = 'idle' | 'waiting' | PredictionStatus;

export interface GenerationResult {
  status: GenerationStatus;
  outputUrl: string | null;
  error: string | null;
  retry: () => void;
  fromCache: boolean;
  noFace: boolean;
}

export function useGeneration(
  imageBase64: string | null,
  styleId: string,
  mimeType: string,
  enabled: boolean = true,
  options: GenerationOptions = {}
): GenerationResult {
  const [status, setStatus]       = useState<GenerationStatus>('idle');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [noFace, setNoFace]       = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const mountedRef  = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!imageBase64) return;
    if (!enabled) { setStatus('waiting'); return; }

    let cancelled = false;

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const run = async () => {
      if (!mountedRef.current || cancelled) return;

      stopPolling();
      setOutputUrl(null);
      setError(null);
      setNoFace(false);

      // ── Cache check ──────────────────────────────────
      const cacheKey = makeCacheKey(
        imageBase64,
        styleId,
        options.strengthRatio ?? 20,
        options.promptSuffix ?? ''
      );
      const cached = await getCached(cacheKey);
      if (cached) {
        if (!mountedRef.current || cancelled) return;
        setFromCache(true);
        setOutputUrl(cached);
        setStatus('succeeded');
        return;
      }
      // ────────────────────────────────────────────────

      setFromCache(false);
      setStatus('starting');

      try {
        const result = await startGeneration(imageBase64, styleId, mimeType, options);
        if (!mountedRef.current || cancelled) return;

        if (result.status === 'succeeded' && result.output) {
          const url = Array.isArray(result.output)
            ? result.output[result.output.length - 1] as string
            : result.output as string;
          setOutputUrl(url);
          setStatus('succeeded');
          setCached(cacheKey, url);
          return;
        }

        setStatus('processing');
        const id = result.id;
        let pollCount = 0;
        const MAX_POLLS = 60; // 60 × 3s = 3 min hard cap

        intervalRef.current = setInterval(async () => {
          if (!mountedRef.current || cancelled) { stopPolling(); return; }

          pollCount++;
          if (pollCount > MAX_POLLS) {
            stopPolling();
            if (mountedRef.current) {
              setStatus('failed');
              setError('Timed out after 3 min. Tap retry.');
            }
            return;
          }

          try {
            const statusResult = await checkStatus(id);
            if (!mountedRef.current || cancelled) return;

            if (statusResult.status === 'succeeded' && statusResult.output) {
              stopPolling();
              const url = Array.isArray(statusResult.output)
                ? statusResult.output[statusResult.output.length - 1]
                : statusResult.output;
              setOutputUrl(url);
              setStatus('succeeded');
              setCached(cacheKey, url);
            } else if (statusResult.status === 'failed' || statusResult.status === 'canceled') {
              stopPolling();
              if (statusResult.error === 'NO_FACE_DETECTED') {
                setNoFace(true);
              }
              setStatus('failed');
              setError(statusResult.error || 'Generation failed. Tap retry.');
            }
          } catch {
            // Swallow transient network errors, keep polling
          }
        }, 3000);

      } catch (e: unknown) {
        if (!mountedRef.current || cancelled) return;
        setStatus('failed');
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    };

    run();
    return () => { cancelled = true; stopPolling(); };
  }, [imageBase64, styleId, mimeType, retryCount, enabled, options.promptSuffix, options.strengthRatio]);

  const retry = useCallback(() => setRetryCount(c => c + 1), []);

  return { status, outputUrl, error, retry, fromCache, noFace };
}
