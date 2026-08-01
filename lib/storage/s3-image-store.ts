import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ImageStore } from "./image-store";

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
    return this.publicBaseUrl
      ? `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
