import type { Artwork } from './types'

const DATABASE_NAME = 'doodle-guess'
const STORE_NAME = 'artworks'
const MAX_ARTWORKS = 100
const MAX_FALLBACK_ARTWORKS = 10
const FALLBACK_KEY = 'doodle-guess-artworks-fallback-v1'

export interface SaveArtworkResult {
  ok: boolean
  /** Number of oldest artworks removed to respect the gallery cap. */
  trimmed: number
  reason?: 'storage-unavailable' | 'write-failed'
}

let databasePromise: Promise<IDBDatabase | null> | null = null

function getDatabase(): Promise<IDBDatabase | null> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const request = indexedDB.open(DATABASE_NAME, 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt')
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    })
  }
  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function readFallback(): Artwork[] {
  try {
    const text = localStorage.getItem(FALLBACK_KEY)
    if (!text) return []
    const parsed = JSON.parse(text) as Artwork[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeFallback(artworks: Artwork[]): { ok: boolean; trimmed: number } {
  try {
    const sorted = [...artworks].sort(
      (left, right) => right.createdAt - left.createdAt,
    )
    const trimmed = Math.max(0, sorted.length - MAX_FALLBACK_ARTWORKS)
    localStorage.setItem(
      FALLBACK_KEY,
      JSON.stringify(sorted.slice(0, MAX_FALLBACK_ARTWORKS)),
    )
    return { ok: true, trimmed }
  } catch {
    return { ok: false, trimmed: 0 }
  }
}

async function trimOldArtworks(database: IDBDatabase): Promise<number> {
  const countTransaction = database.transaction(STORE_NAME, 'readonly')
  const total = await requestResult(
    countTransaction.objectStore(STORE_NAME).count(),
  )
  const excess = Math.max(0, total - MAX_ARTWORKS)
  if (excess === 0) return 0

  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index('createdAt')

  await new Promise<void>((resolve, reject) => {
    let remaining = excess
    // openKeyCursor never deserializes the image payload.
    const request = index.openKeyCursor()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor || remaining <= 0) {
        resolve()
        return
      }
      store.delete(cursor.primaryKey)
      remaining -= 1
      cursor.continue()
    }
  })
  await transactionDone(transaction)
  return excess
}

export async function listArtworks(): Promise<Artwork[]> {
  const database = await getDatabase()
  if (!database) {
    return readFallback().sort((left, right) => right.createdAt - left.createdAt)
  }
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const artworks = await requestResult(store.getAll() as IDBRequest<Artwork[]>)
    return artworks.sort((left, right) => right.createdAt - left.createdAt)
  } catch {
    return readFallback().sort((left, right) => right.createdAt - left.createdAt)
  }
}

export async function saveArtwork(
  artwork: Artwork,
): Promise<SaveArtworkResult> {
  const database = await getDatabase()
  if (!database) {
    const fallback = writeFallback([
      artwork,
      ...readFallback().filter((item) => item.id !== artwork.id),
    ])
    return fallback.ok
      ? { ok: true, trimmed: fallback.trimmed }
      : { ok: false, trimmed: 0, reason: 'storage-unavailable' }
  }

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(artwork)
    await transactionDone(transaction)
  } catch {
    // Do not silently copy to localStorage here: the gallery reads from
    // IndexedDB whenever it is available, so that copy would be invisible.
    return { ok: false, trimmed: 0, reason: 'write-failed' }
  }

  try {
    const trimmed = await trimOldArtworks(database)
    return { ok: true, trimmed }
  } catch {
    // The artwork itself was written; a failed cleanup must not turn a
    // successful save into a false failure.
    return { ok: true, trimmed: 0 }
  }
}

export async function deleteArtwork(id: string): Promise<void> {
  const database = await getDatabase()
  if (!database) {
    writeFallback(readFallback().filter((item) => item.id !== id))
    return
  }
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    await transactionDone(transaction)
  } catch {
    writeFallback(readFallback().filter((item) => item.id !== id))
  }
}

export async function clearArtworks(): Promise<void> {
  const database = await getDatabase()
  if (!database) {
    writeFallback([])
    return
  }
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).clear()
    await transactionDone(transaction)
  } catch {
    writeFallback([])
  }
}

export async function countArtworks(): Promise<number> {
  const database = await getDatabase()
  if (!database) return readFallback().length
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    return await requestResult(transaction.objectStore(STORE_NAME).count())
  } catch {
    return readFallback().length
  }
}

export function makeArtworkId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
