const dev = import.meta.env.DEV

function log(label: string, milliseconds: number): void {
  if (!dev) return
  console.debug(`[perf] ${label}: ${milliseconds.toFixed(1)}ms`)
}

export function measureSync<T>(label: string, run: () => T): T {
  if (!dev) return run()
  const start = performance.now()
  try {
    return run()
  } finally {
    log(label, performance.now() - start)
  }
}

export async function measureAsync<T>(
  label: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!dev) return run()
  const start = performance.now()
  try {
    return await run()
  } finally {
    log(label, performance.now() - start)
  }
}
