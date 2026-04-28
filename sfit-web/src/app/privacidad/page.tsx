import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — SFIT",
  description: "Política de privacidad del Sistema de Fiscalización Inteligente de Transporte Municipal.",
};

export default function PrivacidadPage() {
  return (
    <div style={{ background: "#fafafa", minHeight: "100vh", fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <header style={{
        background: "#0A1628",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 24px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <img src="/logo.svg" alt="SFIT" width={22} height={22} style={{ objectFit: "contain" }} />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-inter)" }}>
            SFIT
          </span>
        </a>
        <a href="/" style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", textDecoration: "none" }}>
          ← Volver al inicio
        </a>
      </header>

      {/* ── Hero ── */}
      <div style={{ background: "#0A1628", padding: "40px 24px 48px", textAlign: "center" }}>
        <p style={{ color: "#6C0606", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: "10px" }}>
          Documentación legal
        </p>
        <h1 style={{
          color: "#ffffff",
          fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
          fontWeight: 800,
          letterSpacing: "-0.025em",
          fontFamily: "var(--font-inter)",
          marginBottom: "10px",
        }}>
          Política de Privacidad
        </h1>
        <p style={{ color: "#71717a", fontSize: "0.875rem" }}>
          Última actualización: 18 de abril de 2026
        </p>
      </div>

      {/* ── Contenido ── */}
      <main style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ background: "#fff", borderRadius: "16px", border: "1.5px solid #e4e4e7", padding: "40px 40px", lineHeight: 1.75, color: "#27272a" }}>

          <Section title="1. Introducción">
            <p>
              El <strong>Sistema de Fiscalización Inteligente de Transporte (SFIT)</strong> es una plataforma
              desarrollada para la gestión y fiscalización de flotas vehiculares municipales en el Perú.
              Esta política describe cómo recopilamos, usamos y protegemos la información de los usuarios
              de nuestra plataforma web y aplicación móvil.
            </p>
            <p style={{ marginTop: "12px" }}>
              Al utilizar SFIT, usted acepta las prácticas descritas en esta política. Si no está de acuerdo,
              le rogamos que no utilice nuestros servicios.
            </p>
          </Section>

          <Section title="2. Datos que recopilamos">
            <p>Recopilamos los siguientes tipos de información:</p>
            <ul style={ulStyle}>
              <li>
                <strong>Datos de cuenta:</strong> nombre completo, correo electrónico institucional,
                fotografía de perfil (si inicia sesión con Google) y rol asignado dentro del sistema.
              </li>
              <li>
                <strong>Datos de municipio:</strong> la provincia y municipalidad a la que pertenece el usuario,
                necesarios para el aislamiento multi-tenant del sistema.
              </li>
              <li>
                <strong>Datos de ubicación:</strong> coordenadas geográficas opcionales capturadas al registrar
                inspecciones de campo o reportes ciudadanos, asociadas al registro correspondiente.
              </li>
              <li>
                <strong>Datos de la cámara:</strong> acceso solicitado exclusivamente para escanear códigos QR
                de vehículos durante las inspecciones. Las imágenes no se almacenan en nuestros servidores.
              </li>
              <li>
                <strong>Datos técnicos:</strong> sistema operativo, modelo del dispositivo, dirección IP y
                registros de actividad (logs) necesarios para la seguridad y el funcionamiento del sistema.
              </li>
              <li>
                <strong>Datos de actividad:</strong> inspecciones realizadas, sanciones registradas, reportes
                enviados y apelaciones gestionadas, como parte del registro oficial del sistema.
              </li>
            </ul>
          </Section>

          <Section title="3. Cómo usamos los datos">
            <p>Utilizamos la información recopilada para:</p>
            <ul style={ulStyle}>
              <li>Autenticar y gestionar las cuentas de usuario de forma segura.</li>
              <li>Facilitar los procesos de fiscalización e inspección vehicular municipal.</li>
              <li>Generar reportes estadísticos agregados para las municipalidades y administradores provinciales.</li>
              <li>Enviar notificaciones relacionadas con la operación del sistema (apelaciones, sanciones, alertas de fatiga).</li>
              <li>Mejorar la experiencia del usuario y la calidad del servicio.</li>
              <li>Garantizar la seguridad e integridad del sistema.</li>
            </ul>
          </Section>

          <Section title="4. Compartir información">
            <p>
              No vendemos, intercambiamos ni transferimos información personal a terceros externos.
              La información se comparte únicamente dentro de la jerarquía administrativa del sistema:
            </p>
            <ul style={ulStyle}>
              <li>Administradores municipales tienen acceso a los datos de los usuarios de su municipalidad.</li>
              <li>Administradores provinciales tienen acceso a los datos agregados de las municipalidades bajo su jurisdicción.</li>
              <li>El Super Administrador tiene acceso global para fines de soporte técnico y configuración del sistema.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              En ningún caso se compartirán datos personales (DNI, datos de contacto privado) fuera de estos ámbitos.
            </p>
          </Section>

          <Section title="5. Seguridad de los datos">
            <p>
              Implementamos medidas de seguridad estándar de la industria para proteger la información:
            </p>
            <ul style={ulStyle}>
              <li>Cifrado de contraseñas con bcrypt (12 rounds de salt).</li>
              <li>Tokens JWT con expiración corta: 15 minutos para access token, 7 días para refresh token.</li>
              <li>Comunicación cifrada mediante HTTPS/TLS en todos los endpoints.</li>
              <li>Control de acceso basado en roles (RBAC) aplicado en cada endpoint de la API.</li>
              <li>Aislamiento total de datos por municipalidad (arquitectura multi-tenant).</li>
              <li>Base de datos alojada en MongoDB Atlas con cifrado en reposo.</li>
            </ul>
          </Section>

          <Section title="6. Retención de datos">
            <p>
              Los datos personales se conservan mientras la cuenta del usuario esté activa en el sistema.
              Los registros de inspección, sanciones y fiscalización se mantienen conforme a las normativas
              municipales vigentes, que pueden requerir su conservación por períodos determinados.
            </p>
            <p style={{ marginTop: "12px" }}>
              Al solicitar la eliminación de su cuenta, los datos de identificación personal serán anonimizados,
              pero los registros de actividad oficial (inspecciones, sanciones) se conservarán por requerimiento legal.
            </p>
          </Section>

          <Section title="7. Derechos del usuario">
            <p>Como usuario de SFIT, usted tiene derecho a:</p>
            <ul style={ulStyle}>
              <li><strong>Acceso:</strong> solicitar una copia de los datos personales que tenemos sobre usted.</li>
              <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos o incompletos.</li>
              <li><strong>Eliminación:</strong> solicitar la eliminación de su cuenta y la anonimización de sus datos personales.</li>
              <li><strong>Revocación de permisos:</strong> revocar los permisos del dispositivo (cámara, ubicación) en cualquier momento desde la configuración de su dispositivo.</li>
              <li><strong>Portabilidad:</strong> solicitar sus datos en un formato estructurado y legible por máquina.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              Para ejercer estos derechos, comuníquese con su administrador municipal o contáctenos directamente.
            </p>
          </Section>

          <Section title="8. Permisos del dispositivo móvil">
            <ul style={ulStyle}>
              <li>
                <strong>Cámara (CAMERA):</strong> utilizada exclusivamente para el escaneo de códigos QR
                durante las inspecciones de campo. No se toman fotografías ni se graba video.
              </li>
              <li>
                <strong>Ubicación (LOCATION):</strong> solicitada opcionalmente para georreferenciar
                inspecciones y reportes ciudadanos.
              </li>
              <li>
                <strong>Internet:</strong> necesario para la comunicación con los servidores del sistema.
              </li>
            </ul>
          </Section>

          <Section title="9. Cambios en esta política">
            <p>
              Nos reservamos el derecho de actualizar esta política de privacidad en cualquier momento.
              Las modificaciones se publicarán en esta misma página con la fecha de actualización correspondiente.
              Para cambios sustanciales, notificaremos a los usuarios mediante el sistema de notificaciones de SFIT.
            </p>
          </Section>

          <Section title="10. Contacto">
            <p>
              Si tiene preguntas, inquietudes o desea ejercer sus derechos sobre sus datos personales,
              puede contactarnos en:
            </p>
            <div style={{ marginTop: "16px", padding: "16px 20px", background: "#fafafa", borderRadius: "10px", border: "1px solid #e4e4e7" }}>
              <p style={{ margin: 0 }}>
                <strong>Correo electrónico:</strong>{" "}
                <a href="mailto:184193@unsaac.edu.pe" style={{ color: "#6C0606", textDecoration: "none", fontWeight: 600 }}>
                  184193@unsaac.edu.pe
                </a>
              </p>
              <p style={{ margin: "8px 0 0" }}>
                <strong>Sistema:</strong> SFIT — Sistema de Fiscalización Inteligente de Transporte
              </p>
              <p style={{ margin: "8px 0 0" }}>
                <strong>País:</strong> Perú
              </p>
            </div>
          </Section>

        </div>

        {/* Links relacionados */}
        <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/terminos" style={linkStyle}>Términos de servicio →</a>
          <a href="/consulta-publica" style={linkStyle}>Consulta pública de vehículos →</a>
          <a href="/" style={linkStyle}>Volver al inicio →</a>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        background: "#09090b",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "20px 24px",
        textAlign: "center",
        color: "rgba(255,255,255,0.2)",
        fontSize: "12px",
      }}>
        © 2026 SFIT — Sistema de Fiscalización Inteligente de Transporte Municipal · Perú
      </footer>
    </div>
  );
}

/* ── Sub-componentes ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "36px" }}>
      <h2 style={{
        fontSize: "1.125rem",
        fontWeight: 700,
        color: "#0A1628",
        marginBottom: "12px",
        paddingBottom: "10px",
        borderBottom: "1.5px solid #f4f4f5",
        letterSpacing: "-0.01em",
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const ulStyle: React.CSSProperties = {
  paddingLeft: "22px",
  marginTop: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const linkStyle: React.CSSProperties = {
  color: "#6C0606",
  textDecoration: "none",
  fontSize: "0.875rem",
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: "8px",
  background: "#fff",
  border: "1.5px solid #e4e4e7",
};
