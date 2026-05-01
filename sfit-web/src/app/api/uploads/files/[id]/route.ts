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

    return new NextResponse(new Uint8Array(file.data as unknown as Buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        // Cache agresivo: el contenido es inmutable (mismo id → mismo bytes).
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[uploads/files GET]", error);
    return new NextResponse("Server error", { status: 500 });
  }
}
