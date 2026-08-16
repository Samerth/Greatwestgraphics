export interface StoredImage {
  data: Buffer;
  contentType: string;
}

export interface ImageStore {
  /** Stores the given bytes under `key` and returns a durable URL for them. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Reads bytes back for the same-origin `/api/uploads/[...key]` route. */
  get(key: string): Promise<StoredImage | null>;
}
