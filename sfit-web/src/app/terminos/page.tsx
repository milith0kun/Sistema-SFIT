import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio — SFIT",
  description: "Términos y condiciones de uso del Sistema de Fiscalización Inteligente de Transporte Municipal.",
};

export default function TerminosPage() {
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
          Términos de Servicio
        </h1>
        <p style={{ color: "#71717a", fontSize: "0.875rem" }}>
          Última actualización: 18 de abril de 2026
        </p>
      </div>

      {/* ── Contenido ── */}
      <main style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ background: "#fff", borderRadius: "16px", border: "1.5px solid #e4e4e7", padding: "40px 40px", lineHeight: 1.75, color: "#27272a" }}>

          <Section title="1. Descripción del servicio">
            <p>
              <strong>SFIT (Sistema de Fiscalización Inteligente de Transporte)</strong> es una plataforma
              digital multi-tenant diseñada para la gestión y fiscalización de flotas vehiculares municipales
              en el Perú. El servicio incluye una plataforma web, una aplicación móvil y una API REST,
              disponibles para municipalidades, fiscales, operadores de empresas de transporte, conductores
              y ciudadanos.
            </p>
            <p style={{ marginTop: "12px" }}>
              Al acceder y usar SFIT, usted acepta quedar vinculado por estos Términos de Servicio.
              Si no está de acuerdo con alguno de estos términos, no utilice el servicio.
            </p>
          </Section>

          <Section title="2. Elegibilidad y acceso">
            <p>Para utilizar SFIT debe:</p>
            <ul style={ulStyle}>
              <li>Ser mayor de 18 años o contar con la autorización de la entidad municipal correspondiente.</li>
              <li>Tener una cuenta activa aprobada por el administrador municipal de su municipalidad.</li>
              <li>Proporcionar información veraz y actualizada durante el registro.</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              El acceso al sistema es otorgado por el administrador de la municipalidad correspondiente
              y puede ser revocado en cualquier momento si se incumplen estos términos.
            </p>
          </Section>

          <Section title="3. Responsabilidades del usuario">
            <p>Al utilizar SFIT, usted se compromete a:</p>
            <ul style={ulStyle}>
              <li>Proporcionar información veraz y precisa en todos los registros, inspecciones y reportes.</li>
              <li>No falsificar ni alterar registros de inspección, sanciones o datos vehiculares.</li>
              <li>Mantener la confidencialidad de su contraseña y notificar inmediatamente cualquier acceso no autorizado.</li>
              <li>Usar el sistema únicamente para los fines para los que fue diseñado y según su rol asignado.</li>
              <li>Respetar los datos personales de otros usuarios y no divulgarlos fuera del sistema.</li>
              <li>No intentar acceder a módulos o datos que correspondan a roles distintos al suyo.</li>
              <li>Reportar únicamente incidencias reales y verificables (ciudadanos); los reportes falsos o maliciosos pueden resultar en la suspensión de la cuenta.</li>
            </ul>
          </Section>

          <Section title="4. Uso aceptable">
            <p>
              Queda expresamente prohibido:
            </p>
            <ul style={ulStyle}>
              <li>Intentar eludir los controles de autenticación o autorización del sistema.</li>
              <li>Realizar ataques de denegación de servicio (DoS/DDoS) contra la plataforma.</li>
              <li>Extraer masivamente datos del sistema mediante scraping u otros medios automatizados sin autorización.</li>
              <li>Usar el sistema para actividades ilegales o contrarias a la normativa peruana vigente.</li>
              <li>Compartir credenciales de acceso con terceros no autorizados.</li>
              <li>Manipular o adulterar registros oficiales de fiscalización.</li>
              <li>Usar los SFITCoins (sistema de gamificación ciudadana) de forma fraudulenta o mediante reportes falsos.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              El incumplimiento de estas prohibiciones puede resultar en la suspensión inmediata de la cuenta
              y en acciones legales conforme a la legislación peruana.
            </p>
          </Section>

          <Section title="5. Propiedad intelectual">
            <p>
              El software SFIT, incluyendo su código fuente, diseño, logotipos, documentación y contenido,
              es propiedad de sus desarrolladores. El uso del servicio no otorga al usuario ningún derecho
              de propiedad intelectual sobre el sistema.
            </p>
            <p style={{ marginTop: "12px" }}>
              Los datos ingresados por las municipalidades (vehículos, inspecciones, sanciones) son
              propiedad de la respectiva entidad municipal y permanecen completamente aislados de otros tenants.
            </p>
          </Section>

          <Section title="6. Disponibilidad del servicio">
            <p>
              SFIT ofrece monitoreo continuo (24/7), sin embargo no garantizamos una disponibilidad del
              100%. Pueden producirse interrupciones por mantenimiento programado, actualizaciones del sistema
              o causas de fuerza mayor. Notificaremos con anticipación razonable las interrupciones planificadas.
            </p>
          </Section>

          <Section title="7. Limitaciones de responsabilidad">
            <p>
              En la máxima medida permitida por la ley peruana, SFIT y sus desarrolladores no serán
              responsables por:
            </p>
            <ul style={ulStyle}>
              <li>Daños directos, indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso del servicio.</li>
              <li>Decisiones administrativas o municipales tomadas con base en los datos del sistema.</li>
              <li>Pérdida de datos causada por el usuario o por eventos de fuerza mayor.</li>
              <li>Accesos no autorizados derivados de la negligencia del usuario en la custodia de sus credenciales.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              SFIT es una herramienta de apoyo a la gestión municipal. Las decisiones finales de fiscalización
              y sanción son responsabilidad de los funcionarios municipales competentes.
            </p>
          </Section>

          <Section title="8. Modificaciones al servicio">
            <p>
              Nos reservamos el derecho de modificar, suspender o discontinuar cualquier parte del servicio
              en cualquier momento, con o sin previo aviso. También podemos actualizar estos Términos de Servicio;
              los cambios sustanciales serán notificados a los usuarios con al menos 15 días de anticipación.
            </p>
          </Section>

          <Section title="9. Terminación del servicio">
            <p>
              Podemos suspender o terminar su acceso al servicio si:
            </p>
            <ul style={ulStyle}>
              <li>Incumple estos Términos de Servicio.</li>
              <li>Su cuenta es revocada por el administrador de su municipalidad.</li>
              <li>La municipalidad a la que pertenece discontinúa el uso de SFIT.</li>
            </ul>
            <p style={{ marginTop: "12px" }}>
              Tras la terminación, su acceso al sistema será desactivado y sus datos personales serán
              tratados conforme a nuestra Política de Privacidad.
            </p>
          </Section>

          <Section title="10. Ley aplicable y jurisdicción">
            <p>
              Estos Términos de Servicio se rigen por las leyes de la <strong>República del Perú</strong>,
              incluyendo la Ley N.° 29733 (Ley de Protección de Datos Personales) y sus reglamentos.
            </p>
            <p style={{ marginTop: "12px" }}>
              Cualquier controversia derivada del uso de SFIT que no pueda resolverse amigablemente
              será sometida a la jurisdicción de los <strong>juzgados y tribunales de la ciudad de Cusco, Perú</strong>,
              con renuncia expresa a cualquier otro fuero o jurisdicción que pudiera corresponder.
            </p>
          </Section>

          <Section title="11. Contacto">
            <p>
              Para consultas relacionadas con estos términos, puede contactarnos en:
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
                <strong>Jurisdicción:</strong> Cusco, Perú
              </p>
            </div>
          </Section>

        </div>

        {/* Links relacionados */}
        <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/privacidad" style={linkStyle}>Política de privacidad →</a>
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
        © 2026 SFIT — Sistema de Fiscalización Inteligente de Transporte Municipal · Cusco, Perú
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
