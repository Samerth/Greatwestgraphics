export interface ImageStore {
  /** Stores the given bytes under `key` and returns a durable, publicly fetchable URL. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
}
