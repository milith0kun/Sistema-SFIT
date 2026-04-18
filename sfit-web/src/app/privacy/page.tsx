export const metadata = {
  title: "Política de Privacidad — SFIT",
  description: "Política de privacidad del Sistema de Fiscalización Inteligente de Transporte.",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        color: "#1a1a2e",
        lineHeight: 1.7,
      }}
    >
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          marginBottom: 8,
          color: "#0A1628",
        }}
      >
        Política de Privacidad
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 32 }}>
        Última actualización: 18 de abril de 2026
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>1. Introducción</h2>
        <p>
          El Sistema de Fiscalización Inteligente de Transporte (<strong>SFIT</strong>) es una
          plataforma desarrollada para la gestión y fiscalización de flotas vehiculares
          municipales. Esta política describe cómo recopilamos, usamos y protegemos la
          información de los usuarios de nuestra aplicación móvil y plataforma web.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>2. Información que recopilamos</h2>
        <ul style={ulStyle}>
          <li>
            <strong>Datos de cuenta:</strong> nombre completo, correo electrónico y rol asignado
            al registrarse o iniciar sesión con Google.
          </li>
          <li>
            <strong>Datos de la cámara:</strong> la app solicita acceso a la cámara del
            dispositivo exclusivamente para escanear códigos QR de vehículos y conductores
            durante las inspecciones de fiscalización. Las imágenes capturadas se procesan en
            tránsito y <strong>no se almacenan</strong> en nuestros servidores.
          </li>
          <li>
            <strong>Datos de ubicación:</strong> se puede solicitar la ubicación del dispositivo
            para registrar el punto geográfico de una inspección o viaje. Esta información se
            asocia al registro correspondiente y no se comparte con terceros.
          </li>
          <li>
            <strong>Datos del dispositivo:</strong> sistema operativo, modelo del dispositivo e
            identificadores técnicos necesarios para el funcionamiento de la app.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>3. Uso de la información</h2>
        <p>Utilizamos la información recopilada para:</p>
        <ul style={ulStyle}>
          <li>Autenticar y gestionar las cuentas de usuario.</li>
          <li>Facilitar los procesos de fiscalización e inspección vehicular.</li>
          <li>Generar reportes estadísticos agregados para las municipalidades.</li>
          <li>Enviar notificaciones relacionadas con la operación del sistema.</li>
          <li>Mejorar la experiencia del usuario y la calidad del servicio.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>4. Compartir información</h2>
        <p>
          No vendemos, intercambiamos ni transferimos información personal a terceros externos.
          La información se comparte únicamente dentro de la jerarquía administrativa del
          sistema (municipalidades y administradores provinciales autorizados) conforme a los
          roles y permisos asignados.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>5. Seguridad de los datos</h2>
        <p>
          Implementamos medidas de seguridad estándar de la industria para proteger la
          información, incluyendo:
        </p>
        <ul style={ulStyle}>
          <li>Cifrado de contraseñas con bcrypt (12 rounds).</li>
          <li>Tokens JWT con expiración de 15 minutos (access) y 7 días (refresh).</li>
          <li>Comunicación cifrada mediante HTTPS/TLS.</li>
          <li>Control de acceso basado en roles (RBAC) en todos los endpoints.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>6. Permisos del dispositivo</h2>
        <ul style={ulStyle}>
          <li>
            <strong>Cámara (android.permission.CAMERA):</strong> utilizada exclusivamente para
            el escaneo de códigos QR durante las inspecciones. No se toman fotografías ni se
            graba video. El usuario puede revocar este permiso en cualquier momento desde la
            configuración del dispositivo.
          </li>
          <li>
            <strong>Internet:</strong> necesario para la comunicación con los servidores del
            sistema.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>7. Retención de datos</h2>
        <p>
          Los datos personales se conservan mientras la cuenta del usuario esté activa. Los
          registros de inspección y fiscalización se mantienen conforme a las normativas
          municipales vigentes. El usuario puede solicitar la eliminación de su cuenta
          contactando al administrador de su municipalidad.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>8. Derechos del usuario</h2>
        <p>El usuario tiene derecho a:</p>
        <ul style={ulStyle}>
          <li>Acceder a sus datos personales almacenados en el sistema.</li>
          <li>Solicitar la corrección de datos inexactos.</li>
          <li>Solicitar la eliminación de su cuenta y datos asociados.</li>
          <li>Revocar los permisos del dispositivo en cualquier momento.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>9. Cambios en esta política</h2>
        <p>
          Nos reservamos el derecho de actualizar esta política de privacidad en cualquier
          momento. Las modificaciones se publicarán en esta misma página con la fecha de
          actualización correspondiente.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={h2Style}>10. Contacto</h2>
        <p>
          Si tienes preguntas sobre esta política de privacidad, puedes contactarnos a través
          del correo electrónico del administrador del sistema o mediante los canales oficiales
          de tu municipalidad.
        </p>
      </section>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid #e5e7eb",
          color: "#9ca3af",
          fontSize: "0.875rem",
          textAlign: "center",
        }}
      >
        © {new Date().getFullYear()} SFIT — Sistema de Fiscalización Inteligente de Transporte
      </footer>
    </main>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  color: "#0A1628",
  marginBottom: 12,
};

const ulStyle: React.CSSProperties = {
  paddingLeft: 24,
  marginTop: 8,
};
