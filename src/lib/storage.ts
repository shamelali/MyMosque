import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

// D02 object storage: local filesystem adapter for the demo.
// Production: point this module at the Malaysian-region object store (S3-compatible).
const ROOT = path.join(process.cwd(), ".storage");

function safePath(key: string) {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT + path.sep)) throw new Error("Kunci storan tidak sah");
  return resolved;
}

export async function putObject(input: {
  key?: string;
  data: Buffer;
  contentType: string;
  originalName?: string;
}) {
  const key = input.key ?? `${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
  const target = safePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.data);
  await prisma.storedFile.upsert({
    where: { key },
    create: {
      key,
      contentType: input.contentType,
      size: input.data.length,
      originalName: input.originalName,
    },
    update: { size: input.data.length, contentType: input.contentType },
  });
  return key;
}

export async function getObject(key: string) {
  const file = await prisma.storedFile.findUnique({ where: { key } });
  if (!file) return null;
  const data = await readFile(safePath(key));
  return { ...file, data };
}
