import mongoose, { Schema, type Document, type Model } from "mongoose";

/**
 * Archivo binario almacenado en MongoDB.
 * Reemplaza el storage en /public/uploads (efímero en contenedores Dokploy).
 *
 * Las imágenes ≤5 MB caben holgadamente en un documento Mongo (límite 16 MB).
 * Si en el futuro se necesitan archivos más grandes, migrar a GridFS.
 */
export interface IUploadedFile extends Document {
  data: Buffer;
  mimeType: string;
  size: number;
  category: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const UploadedFileSchema = new Schema<IUploadedFile>(
  {
    data: { type: Buffer, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    category: { type: String, required: true, index: true },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

UploadedFileSchema.index({ createdAt: -1 });

export const UploadedFile: Model<IUploadedFile> =
  (mongoose.models.UploadedFile as Model<IUploadedFile> | undefined) ||
  mongoose.model<IUploadedFile>("UploadedFile", UploadedFileSchema);
