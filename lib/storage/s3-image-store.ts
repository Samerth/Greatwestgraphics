import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ImageStore, StoredImage } from "./image-store";

export class S3ImageStore implements ImageStore {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    private readonly region: string,
    private readonly publicBaseUrl?: string,
  ) {
    this.client = new S3Client({ region });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
    // A configured public base is the operator saying these objects really
    // are served publicly from a CDN, so hand that URL straight out. With no
    // such base the bucket is private — the regional S3 URL would 403 in the
    // browser — so route reads back through our own origin instead, which
    // also keeps customer artwork behind the same session checks as the rest
    // of the app and sidesteps needing CORS on the bucket for canvas export.
    return this.publicBaseUrl
      ? `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`
      : `/api/uploads/${key}`;
  }

  async get(key: string): Promise<StoredImage | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return {
        data: Buffer.from(await result.Body.transformToByteArray()),
        contentType: result.ContentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
}
