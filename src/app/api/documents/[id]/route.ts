import { handleApiError, HttpError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function pdfFilename(name: string) {
  const base = name.replace(/[\\/:*?"<>|]/g, "-").trim() || "dokumen";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser();
    const { id } = await params;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new HttpError(404, "Dokumen tidak dijumpai.");

    let file: Awaited<ReturnType<typeof getObject>> = null;
    try {
      file = await getObject(doc.storageKey);
    } catch (error) {
      console.error("[documents] fail storan tidak dapat dibaca", error);
    }
    if (!file) throw new HttpError(404, "Dokumen tidak dijumpai.");

    const filename = pdfFilename(file.originalName ?? doc.title);

    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": contentDisposition(filename),
        "Content-Length": String(file.data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
