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
  /**
   * Región (departamento) — nivel más alto de la jerarquía geográfica.
   * Solo aplica al rol `admin_regional` (lo asigna super_admin); en otros
   * roles se denormaliza automáticamente desde `Province.regionId` por el
   * hook pre-save/findOneAndUpdate.
   */
  regionId?: mongoose.Types.ObjectId;
  /**
   * Empresa de transporte vinculada al usuario. Solo aplica al rol "operador":
   * representa la empresa cuya flota gestiona. Se usa en lugar de buscar
   * via Driver para evitar el coupling histórico operador→Driver.
   */
  companyId?: mongoose.Types.ObjectId;

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

  // Anti-fraude reportes ciudadanos (RF-12)
  /**
   * Reportes rechazados consecutivos. Se incrementa al rechazar un reporte
   * del ciudadano y se resetea a 0 cuando uno se valida. Al alcanzar 3
   * el sistema marca al usuario como "suspendido" y no puede enviar más
   * reportes hasta que un admin lo reactive.
   */
  consecutiveRejectedReports: number;

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
    regionId: {
      type: Schema.Types.ObjectId,
      ref: "Region",
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    // Rol y estado
    role: {
      type: String,
      enum: [
        "super_admin",
        "admin_regional",
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

    // Anti-fraude reportes ciudadanos (RF-12)
    consecutiveRejectedReports: { type: Number, default: 0, min: 0 },

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
UserSchema.index({ provinceId: 1, status: 1 });

/**
 * Hooks de denormalización: cuando se setea o cambia `municipalityId`, el
 * `provinceId` se llena automáticamente leyendo la municipalidad. Así los
 * listados del admin_provincial pueden filtrar simplemente por `provinceId`
 * sin necesidad de joins ni $or compuestos.
 *
 * Cubre dos rutas: documentos hidratados (`new User().save()` /
 * `doc.save()`) vía pre("save"), y queries de actualización
 * (`findOneAndUpdate` / `updateOne` / `updateMany`) vía pre de query.
 */
async function deriveProvinceFromMunicipality(
  muniId: mongoose.Types.ObjectId | string | null | undefined,
): Promise<mongoose.Types.ObjectId | null> {
  if (!muniId) return null;
  const Municipality = mongoose.models.Municipality;
  if (!Municipality) return null;
  const muni = await Municipality.findById(muniId)
    .select("provinceId")
    .lean<{ provinceId?: mongoose.Types.ObjectId } | null>();
  return muni?.provinceId ?? null;
}

async function deriveRegionFromProvince(
  provId: mongoose.Types.ObjectId | string | null | undefined,
): Promise<mongoose.Types.ObjectId | null> {
  if (!provId) return null;
  const Province = mongoose.models.Province;
  if (!Province) return null;
  const prov = await Province.findById(provId)
    .select("regionId")
    .lean<{ regionId?: mongoose.Types.ObjectId } | null>();
  return prov?.regionId ?? null;
}

UserSchema.pre("save", async function () {
  // Cadena de denormalización: muni → province → region.
  if (this.isModified("municipalityId")) {
    if (this.municipalityId) {
      const provinceId = await deriveProvinceFromMunicipality(this.municipalityId);
      if (provinceId) this.provinceId = provinceId;
    } else {
      // Si se quita la muni y no se setea explícitamente otra provincia,
      // limpiamos provinceId para evitar quedar con un dato inconsistente.
      // El admin_provincial es la excepción: tiene provinceId pero no muni,
      // y eso se setea explícitamente en el endpoint assign-admin-provincial.
      if (!this.isModified("provinceId")) this.provinceId = undefined;
    }
  }
  // Si provinceId quedó modificado (sea por muni→prov o por asignación
  // directa), derivar también regionId desde Province.regionId.
  if (this.isModified("provinceId")) {
    if (this.provinceId) {
      const regionId = await deriveRegionFromProvince(this.provinceId);
      if (regionId) this.regionId = regionId;
    } else if (!this.isModified("regionId")) {
      this.regionId = undefined;
    }
  }
});

UserSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], async function () {
  // El update de Mongoose puede venir como objeto plano o con operadores ($set, $unset).
  // Solo nos interesa cuando se está modificando `municipalityId`.
  const update = this.getUpdate();
  if (!update || Array.isArray(update)) return; // pipelines no se manejan aquí

  // Buscar municipalityId en update raíz o dentro de $set
  let muniId: unknown;
  let touched = false;
  if ("municipalityId" in update) {
    muniId = (update as Record<string, unknown>).municipalityId;
    touched = true;
  } else if (
    "$set" in update &&
    typeof (update as { $set?: Record<string, unknown> }).$set === "object" &&
    (update as { $set: Record<string, unknown> }).$set &&
    "municipalityId" in (update as { $set: Record<string, unknown> }).$set
  ) {
    muniId = (update as { $set: Record<string, unknown> }).$set.municipalityId;
    touched = true;
  }
  if (!touched) return;

  const provinceId = await deriveProvinceFromMunicipality(
    muniId as mongoose.Types.ObjectId | string | null | undefined,
  );

  if (provinceId) {
    if ("$set" in update) {
      (update as { $set: Record<string, unknown> }).$set.provinceId = provinceId;
    } else {
      (update as Record<string, unknown>).provinceId = provinceId;
    }
  } else {
    // Sin muni → limpiar provinceId también (a menos que ya se esté seteando explícitamente).
    const setObj = (update as { $set?: Record<string, unknown> }).$set;
    const explicitProv = setObj && "provinceId" in setObj
      ? true
      : "provinceId" in update;
    if (!explicitProv) {
      if ("$set" in update) {
        (update as { $set: Record<string, unknown> }).$set.provinceId = undefined;
      } else {
        (update as Record<string, unknown>).provinceId = undefined;
      }
    }
  }

  // Cadena: si provinceId quedó seteado, derivar regionId desde Province.regionId.
  const finalProvId =
    ("$set" in update && (update as { $set: Record<string, unknown> }).$set.provinceId) ||
    (update as Record<string, unknown>).provinceId;
  const regionId = await deriveRegionFromProvince(
    finalProvId as mongoose.Types.ObjectId | string | null | undefined,
  );
  if (regionId) {
    if ("$set" in update) {
      (update as { $set: Record<string, unknown> }).$set.regionId = regionId;
    } else {
      (update as Record<string, unknown>).regionId = regionId;
    }
  } else if (!finalProvId) {
    const setObj = (update as { $set?: Record<string, unknown> }).$set;
    const explicitReg = setObj && "regionId" in setObj
      ? true
      : "regionId" in update;
    if (!explicitReg) {
      if ("$set" in update) {
        (update as { $set: Record<string, unknown> }).$set.regionId = undefined;
      } else {
        (update as Record<string, unknown>).regionId = undefined;
      }
    }
  }

  this.setUpdate(update);
});

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
