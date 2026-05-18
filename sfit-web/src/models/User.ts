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
  /**
   * Provincia derivada automáticamente desde la municipalidad por el hook
   * pre-save/pre-findOneAndUpdate. Se mantiene aunque la jerarquía web sea
   * solo super_admin → admin_municipal porque el modelo geográfico se
   * conserva para datos históricos y para identificar la muni activa.
   */
  provinceId?: mongoose.Types.ObjectId;
  /**
   * Región (departamento) derivada automáticamente desde la provincia.
   * Se mantiene por consistencia con el modelo geográfico.
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

  /**
   * Contador que se incrementa cuando un admin cambia el rol del usuario.
   * El JWT incluye este número en su payload; cuando un cliente presenta un
   * token con `sessionVersion` distinto al actual del usuario, el servidor
   * responde 401 con `code: "SESSION_INVALIDATED"` y el cliente fuerza logout.
   * Esto garantiza que cambios de rol invaliden las sesiones vivas sin
   * tener que esperar 2 h a que expire el access token.
   */
  sessionVersion: number;

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

    // Versionado de sesión: ver doc en IUser.sessionVersion
    sessionVersion: { type: Number, default: 1 },

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

// DNI único nacional. Sparse permite que la mayoría de cuentas Google/registro
// inicial no tengan DNI hasta completar onboarding; unique bloquea duplicados
// a nivel DB y cierra el race condition de las validaciones por aplicación.
UserSchema.index({ dni: 1 }, { unique: true, sparse: true });

/**
 * Hooks de denormalización: cuando se setea o cambia `municipalityId`, el
 * `provinceId` y `regionId` se llenan automáticamente leyendo la jerarquía
 * geográfica. Mantenemos la denormalización aunque la jerarquía web ya no
 * use admin_provincial/admin_regional, porque el modelo geográfico
 * (Region/Province/Municipality) sigue siendo fuente de verdad para datos
 * históricos y para identificar el tenant activo.
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
