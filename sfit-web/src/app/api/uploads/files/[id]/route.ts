import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { UploadedFile } from "@/models/UploadedFile";

/**
 * GET /api/uploads/files/[id]
 * Sirve el binario de un archivo almacenado en MongoDB.
 *
 * Sin auth: el ID es un ObjectId aleatorio de 24 hex (no enumerable),
 * mismo modelo de seguridad que tenían los UUIDs servidos desde /public.
 * Las imágenes se cargan vía `<img src>` que no envía Bearer tokens.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  try {
    await connectDB();
    const file = await UploadedFile.findById(id).lean();
    if (!file) return new NextResponse("Not found", { status: 404 });

    // file.data viene como Buffer (Mongoose Binary subtype). Lo convertimos
    // a Uint8Array para asegurar compatibilidad con BodyInit del runtime
    // de Next 16. NO enviamos Content-Length manualmente: detrás de
    // Cloudflare la compresión transparente cambia el tamaño real del body
    // y un Content-Length declarado por el origen produce
    // ERR_HTTP2_PROTOCOL_ERROR en el cliente. El runtime/proxy calcula
    // el header correcto a partir del body.
    const buf = file.data as unknown as Buffer;
    // Copiamos a un ArrayBuffer fresco para evitar problemas de tipo con
    // Next 16 (Uint8Array<ArrayBufferLike> no satisface BodyInit estricto)
    // y para que el body sea independiente del Buffer subyacente de Mongoose.
    const body = new ArrayBuffer(buf.byteLength);
    new Uint8Array(body).set(buf);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        // Cache agresivo: el contenido es inmutable (mismo id → mismos bytes).
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[uploads/files GET]", error);
    return new NextResponse("Server error", { status: 500 });
  }
}
