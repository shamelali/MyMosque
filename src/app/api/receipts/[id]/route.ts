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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser();
    const { id } = await params;

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { mosque: { select: { name: true, code: true } } },
    });
    if (!receipt || !receipt.storageKey) {
      throw new HttpError(404, "Resit tidak dijumpai");
    }

    let file: Awaited<ReturnType<typeof getObject>> = null;
    try {
      file = await getObject(receipt.storageKey);
    } catch (error) {
      console.error("[receipts] fail storan tidak dapat dibaca", error);
    }
    if (!file) throw new HttpError(404, "Resit tidak dijumpai");

    const filename = `resit-${receipt.number.replaceAll("/", "-")}.pdf`;

    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.contentType || "application/pdf",
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
