import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { Role, UserStatus } from "@/lib/constants";

/**
 * Interfaz del documento de Usuario en MongoDB.
 * Corresponde al flujo RF-01 del Readme.
 */
export interface IUser extends Document {
  name: string;
  email: string;
  password?: string; // Null para cuentas de Google
  image?: string;
  provider: "credentials" | "google";
  providerId?: string;

  // Multi-tenancy
  municipalityId?: mongoose.Types.ObjectId;
  provinceId?: mongoose.Types.ObjectId;

  // Rol y estado (RF-01-03, RF-01-04)
  role: Role;
  requestedRole?: Role;
  /** Justificación opcional que el usuario deja al admin al solicitar acceso. */
  requestMessage?: string;
  status: UserStatus;
  rejectionReason?: string;

  // Perfil (RF-01-12)
  phone?: string;
  dni?: string;

  // Onboarding (RF-01-13)
  profileCompleted: boolean;     // false hasta que el usuario complete DNI/teléfono al primer login
  mustChangePassword: boolean;   // true cuando super_admin asignó password temporal

  // FCM Push Tokens (RF-18)
  fcmTokens: string[];

  // Tokens
  refreshToken?: string;
  refreshTokenExpiry?: Date;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false }, // No se incluye en queries por defecto
    image: { type: String },
    provider: {
      type: String,
      enum: ["credentials", "google"],
      default: "credentials",
    },
    providerId: { type: String },

    // Multi-tenancy
    municipalityId: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
      index: true,
    },
    provinceId: {
      type: Schema.Types.ObjectId,
      ref: "Province",
      index: true,
    },

    // Rol y estado
    role: {
      type: String,
      enum: [
        "super_admin",
        "admin_provincial",
        "admin_municipal",
        "fiscal",
        "operador",
        "conductor",
        "ciudadano",
      ],
      default: "ciudadano",
    },
    requestedRole: {
      type: String,
      enum: [
        "fiscal",
        "operador",
        "conductor",
        "ciudadano",
      ],
    },
    requestMessage: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["pendiente", "activo", "rechazado", "suspendido"],
      default: "pendiente",
    },
    rejectionReason: { type: String },

    // Perfil
    phone: { type: String },
    dni: { type: String },

    // Onboarding
    profileCompleted: { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },

    // FCM Push Tokens (RF-18)
    fcmTokens: { type: [String], default: [] },

    // Tokens
    refreshToken: { type: String, select: false },
    refreshTokenExpiry: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry: { type: Date },

    // Timestamps
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Índices compuestos para multi-tenancy
UserSchema.index({ municipalityId: 1, role: 1 });
UserSchema.index({ municipalityId: 1, status: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
