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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidObjectId(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  const debug = new URL(request.url).searchParams.get("debug") === "1";

  try {
    await connectDB();
    // Sin .lean(): cuando se serializa el campo Buffer con .lean() en algunas
    // versiones de Mongoose viene como Binary del driver de mongo, no como
    // Node Buffer, y los wrappers de TypedArray no copian correctamente.
    // findById() devuelve un doc hidratado donde file.data es un Buffer real.
    const file = await UploadedFile.findById(id);
    if (!file) return new NextResponse("Not found", { status: 404 });

    // Forzamos a Buffer node real (cubre el caso de Binary subtype).
    const raw = file.data as unknown;
    let buf: Buffer;
    if (Buffer.isBuffer(raw)) {
      buf = raw;
    } else if (raw && typeof raw === "object" && "buffer" in raw) {
      // Mongoose Binary { buffer: Buffer, sub_type: number }
      const inner = (raw as { buffer: unknown }).buffer;
      buf = Buffer.isBuffer(inner) ? inner : Buffer.from(inner as ArrayBufferLike);
    } else {
      buf = Buffer.from(raw as ArrayBufferLike);
    }

    if (!buf || buf.byteLength === 0) {
      console.error("[uploads/files GET] empty buffer", { id, type: typeof raw });
      return new NextResponse("Empty file", { status: 500 });
    }

    // Modo diagnóstico: devuelve JSON con metadatos del archivo y los
    // primeros 16 bytes en hex para validar que el binario almacenado
    // tiene la firma del formato esperado (WebP: 52 49 46 46 ... 57 45 42 50).
    if (debug) {
      const head = Array.from(buf.subarray(0, 16))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      const tail = Array.from(buf.subarray(Math.max(0, buf.byteLength - 8)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ");
      const isWebP =
        buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
      return NextResponse.json({
        id,
        mimeType: file.mimeType,
        sizeStored: file.size,
        bufferByteLength: buf.byteLength,
        sizesMatch: file.size === buf.byteLength,
        isWebP,
        hexHead: head,
        hexTail: tail,
        rawType: typeof raw,
        wasBuffer: Buffer.isBuffer(raw),
      });
    }

    // Copiamos a un ArrayBuffer fresco e independiente del Buffer original.
    // No enviamos Content-Length manualmente: detrás de Cloudflare la
    // compresión transparente cambia el tamaño real del body y declarar
    // Content-Length en el origen produce ERR_HTTP2_PROTOCOL_ERROR.
    const body = new ArrayBuffer(buf.byteLength);
    new Uint8Array(body).set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        // Cache agresivo: el contenido es inmutable (mismo id → mismos bytes).
        "Cache-Control": "public, max-age=31536000, immutable",
        // Necesario para que el navegador permita cargar el binario como
        // imagen aunque el origin sea distinto del que sirvió la página.
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (error) {
    console.error("[uploads/files GET]", error);
    return new NextResponse("Server error", { status: 500 });
  }
}
