import type { Artwork } from './types'

const DATABASE_NAME = 'doodle-guess'
const STORE_NAME = 'artworks'
const MAX_ARTWORKS = 100
const MAX_FALLBACK_ARTWORKS = 10
const FALLBACK_KEY = 'doodle-guess-artworks-fallback-v1'

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

function writeFallback(artworks: Artwork[]): void {
  try {
    const trimmed = [...artworks]
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, MAX_FALLBACK_ARTWORKS)
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage is full or unavailable; the artwork simply will not persist.
  }
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

export async function saveArtwork(artwork: Artwork): Promise<void> {
  const database = await getDatabase()
  if (!database) {
    const existing = readFallback().filter((item) => item.id !== artwork.id)
    writeFallback([artwork, ...existing])
    return
  }

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.put(artwork)
    await transactionDone(transaction)

    const all = await listArtworks()
    if (all.length > MAX_ARTWORKS) {
      const extra = all.slice(MAX_ARTWORKS)
      const cleanup = database.transaction(STORE_NAME, 'readwrite')
      const cleanupStore = cleanup.objectStore(STORE_NAME)
      for (const item of extra) cleanupStore.delete(item.id)
      await transactionDone(cleanup)
    }
  } catch {
    const existing = readFallback().filter((item) => item.id !== artwork.id)
    writeFallback([artwork, ...existing])
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
  const artworks = await listArtworks()
  return artworks.length
}

export function makeArtworkId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
