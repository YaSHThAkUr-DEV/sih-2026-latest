import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000';
const accessKeyId = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretAccessKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
export const BUCKET_NAME = process.env.MINIO_BUCKET || 'dms-documents';

export const s3Client = new S3Client({
  endpoint,
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Required for MinIO
});

export async function ensureBucketExists(): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    return true;
  } catch (err: any) {
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      console.log(`✓ MinIO bucket '${BUCKET_NAME}' created successfully.`);
      return true;
    } catch (createErr: any) {
      console.warn(`[MINIO_WARN] Could not ensure bucket '${BUCKET_NAME}':`, createErr.message);
      return false;
    }
  }
}

export async function putEncryptedObject(key: string, data: Buffer, metadata?: Record<string, string>): Promise<string> {
  await ensureBucketExists();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: 'application/octet-stream',
      Metadata: metadata,
    })
  );

  return key;
}

export async function getEncryptedObject(key: string): Promise<Buffer> {
  const res = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );

  const streamToBuffer = async (stream: any): Promise<Buffer> => {
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  };

  return streamToBuffer(res.Body);
}
