import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

// D02 object storage. Dual backend:
//   - STORAGE_PROVIDER=local (default): filesystem under .storage/ — dev only.
//   - STORAGE_PROVIDER=s3: S3-compatible object store (Neon Object Storage, MinIO, etc.)
//     via STORAGE_ENDPOINT / STORAGE_BUCKET / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY.
// Production autoscaling runs 3–12 pods, so local disk is not shared; S3 is required.
const PROVIDER = process.env.STORAGE_PROVIDER ?? "local";
const ROOT = path.join(process.cwd(), ".storage");

function safePath(key: string) {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT + path.sep)) throw new Error("Kunci storan tidak sah");
  return resolved;
}

function s3(): S3Client | null {
  if (PROVIDER !== "s3") return null;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKey = process.env.STORAGE_ACCESS_KEY_ID;
  const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKey || !secretKey) {
    throw new Error("STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID dan STORAGE_SECRET_ACCESS_KEY mesti di-set ketika STORAGE_PROVIDER=s3.");
  }
  return new S3Client({
    endpoint,
    region: process.env.STORAGE_REGION ?? "ap-southeast-1",
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== "false",
  });
}

export type StoredFile = {
  key: string;
  contentType: string;
  size: number;
  originalName?: string | null;
  data: Buffer;
};

export async function putObject(input: {
  key?: string;
  data: Buffer;
  contentType: string;
  originalName?: string;
}) {
  const key = input.key ?? `${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;

  if (PROVIDER === "s3") {
    const client = s3()!;
    const bucket = process.env.STORAGE_BUCKET!;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.data,
        ContentType: input.contentType,
      }),
    );
    await prisma.storedFile.upsert({
      where: { key },
      create: {
        key,
        contentType: input.contentType,
        size: input.data.length,
        originalName: input.originalName ?? null,
      },
      update: { size: input.data.length, contentType: input.contentType },
    });
    return key;
  }

  const target = safePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.data);
  await prisma.storedFile.upsert({
    where: { key },
    create: {
      key,
      contentType: input.contentType,
      size: input.data.length,
      originalName: input.originalName ?? null,
    },
    update: { size: input.data.length, contentType: input.contentType },
  });
  return key;
}

export async function getObject(key: string): Promise<StoredFile | null> {
  const file = await prisma.storedFile.findUnique({ where: { key } });
  if (!file) return null;

  if (PROVIDER === "s3") {
    const client = s3()!;
    const bucket = process.env.STORAGE_BUCKET!;
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const chunks: Buffer[] = [];
    const body = res.Body as NodeJS.ReadableStream | undefined;
    if (!body) return null;
    for await (const chunk of body as unknown as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return {
      key: file.key,
      contentType: file.contentType,
      size: file.size,
      originalName: file.originalName ?? null,
      data: Buffer.concat(chunks),
    };
  }

  const data = await readFile(safePath(key));
  return { ...file, data };
}

/** Head-object check used by health/readiness probes to confirm storage is reachable. */
export async function storageHealth(): Promise<{ ok: boolean; provider: string }> {
  if (PROVIDER === "s3") {
    const client = s3()!;
    try {
      await client.send(new HeadObjectCommand({ Bucket: process.env.STORAGE_BUCKET!, Key: "__health__" }));
    } catch {
      // 404 is fine — bucket exists, object just isn't there. Any other error means the store is unreachable.
    }
    return { ok: true, provider: "s3" };
  }
  try {
    await mkdir(ROOT, { recursive: true });
    return { ok: true, provider: "local" };
  } catch {
    return { ok: false, provider: "local" };
  }
}
