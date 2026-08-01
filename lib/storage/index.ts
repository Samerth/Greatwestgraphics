import type { ImageStore } from "./image-store";
import { LocalImageStore } from "./local-image-store";
import { S3ImageStore } from "./s3-image-store";

let instance: ImageStore | null = null;

/** S3 when `AWS_S3_BUCKET`/`AWS_REGION` are configured, else a local dev fallback. */
export function getImageStore(): ImageStore {
  if (!instance) {
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;
    instance =
      bucket && region
        ? new S3ImageStore(bucket, region, process.env.AWS_S3_PUBLIC_BASE_URL)
        : new LocalImageStore();
  }
  return instance;
}

export type { ImageStore } from "./image-store";
