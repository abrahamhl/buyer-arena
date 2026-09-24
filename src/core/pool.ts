/**
 * Bounded-concurrency map. Never runs more than `limit` tasks at once.
 * Stops scheduling new work once `signal` aborts; in-flight tasks finish.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  const width = Math.max(1, Math.min(limit, items.length));
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      if (signal?.aborted) return;
      const i = next++;
      results[i] = await fn(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
  return results;
}
