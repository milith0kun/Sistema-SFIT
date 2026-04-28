import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Ban,
  QrCode,
  FileText,
  Users,
  ArrowRight,
  Inbox,
  Search,
  Building2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { spacing, radius, breakpoints, palette } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Design System · SFIT",
  description: "Catálogo visual de tokens y componentes del sistema SFIT.",
};

const SECTION: CSSProperties = {
  borderTop: "1.5px solid #e4e4e7",
  paddingTop: 32,
  paddingBottom: 32,
};

const SECTION_TITLE: CSSProperties = {
  fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.18em",
  color: "#6C0606",
  textTransform: "uppercase",
  marginBottom: 4,
};

const SECTION_HEADING: CSSProperties = {
  fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
  fontSize: "1.5rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "#09090b",
  marginBottom: 6,
};

const SECTION_SUB: CSSProperties = {
  color: "#71717a",
  fontSize: "0.9375rem",
  lineHeight: 1.55,
  marginBottom: 24,
  maxWidth: 640,
};

const GRID_AUTO: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 14,
};

function Section({ kicker, title, subtitle, children }: { kicker: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section style={SECTION}>
      <div style={SECTION_TITLE}>{kicker}</div>
      <h2 style={SECTION_HEADING}>{title}</h2>
      {subtitle && <p style={SECTION_SUB}>{subtitle}</p>}
      {children}
    </section>
  );
}

function Swatch({ name, hex, fg = "#fff" }: { name: string; hex: string; fg?: string }) {
  return (
    <div style={{ borderRadius: 12, border: "1.5px solid #e4e4e7", overflow: "hidden", background: "#fff" }}>
      <div style={{ background: hex, color: fg, padding: "28px 14px", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {name}
      </div>
      <div style={{ padding: "10px 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.75rem", color: "#52525b" }}>
        {hex}
      </div>
    </div>
  );
}

function StatusPill({
  variant,
  children,
}: {
  variant: "apto" | "riesgo" | "no_apto";
  children: ReactNode;
}) {
  const map = {
    apto:    { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC", icon: <ShieldCheck size={12} /> },
    riesgo:  { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D", icon: <AlertTriangle size={12} /> },
    no_apto: { bg: "#FFF5F5", color: "#DC2626", border: "#FCA5A5", icon: <Ban size={12} /> },
  } as const;
  const v = map[variant];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      background: v.bg,
      color: v.color,
      border: `1px solid ${v.border}`,
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.01em",
    }}>
      {v.icon}
      {children}
    </span>
  );
}

function RolePill({ label, kind }: { label: string; kind: "super" | "admin" | "fiscalizador" | "transportista" | "publico" }) {
  const map = {
    super:         { bg: "#FBEAEA", color: "#4A0303", border: "#D9B0B0" },
    admin:         { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    fiscalizador:  { bg: "#F0FDF4", color: "#15803d", border: "#86EFAC" },
    transportista: { bg: "#FFFBEB", color: "#b45309", border: "#FCD34D" },
    publico:       { bg: "#F4F4F5", color: "#52525b", border: "#E4E4E7" },
  } as const;
  const v = map[kind];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: 999,
      background: v.bg,
      color: v.color,
      border: `1px solid ${v.border}`,
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.01em",
    }}>
      {label}
    </span>
  );
}

function KpiCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1.5px solid #e4e4e7",
      borderRadius: 14,
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.14em", color: "#6C0606", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-inter)", fontSize: "1.875rem", fontWeight: 800, color: "#09090b", letterSpacing: "-0.025em", marginTop: 2 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: "0.8125rem", color: "#71717a", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main style={{
      maxWidth: 1100,
      margin: "0 auto",
      padding: "48px 24px 96px",
      fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      color: "#09090b",
    }}>
      <PageHeader
        kicker="SFIT · Visual QA"
        title="Catálogo de diseño del sistema"
        subtitle="Vista única para auditar tokens, tipografía y componentes después del rebrand institucional al rojo #6C0606."
      />

      {/* ─── PALETA ─── */}
      <Section
        kicker="01 · Tokens"
        title="Paleta institucional"
        subtitle="Rojo institucional UNSAAC (#6C0606) como color primario, con variantes de soporte y colores de estado para flujos de fiscalización."
      >
        <div style={{ display: "grid", gap: 24 }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#52525b", marginBottom: 10 }}>Primarios</div>
            <div style={GRID_AUTO}>
              <Swatch name="Primary" hex="#6C0606" />
              <Swatch name="Primary light" hex="#8B1414" />
              <Swatch name="Primary dark" hex="#4A0303" />
              <Swatch name="Primary bg" hex="#FBEAEA" fg="#4A0303" />
              <Swatch name="Primary border" hex="#D9B0B0" fg="#4A0303" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#52525b", marginBottom: 10 }}>Estados de fiscalización</div>
            <div style={GRID_AUTO}>
              <Swatch name="Apto" hex="#15803d" />
              <Swatch name="Riesgo" hex="#b45309" />
              <Swatch name="No apto" hex="#DC2626" />
              <Swatch name="Info" hex="#1D4ED8" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#52525b", marginBottom: 10 }}>Neutrales</div>
            <div style={GRID_AUTO}>
              <Swatch name="Ink" hex="#09090b" />
              <Swatch name="Body" hex="#18181b" />
              <Swatch name="Muted" hex="#52525b" />
              <Swatch name="Sub" hex="#71717a" />
              <Swatch name="Border" hex="#e4e4e7" fg="#52525b" />
              <Swatch name="Surface" hex="#F8F9FA" fg="#52525b" />
            </div>
          </div>
        </div>
      </Section>

      {/* ─── TIPOGRAFÍA ─── */}
      <Section
        kicker="02 · Tipografía"
        title="Escala tipográfica"
        subtitle="Tipografía única Inter (400/500/600/700) con tracking ajustado para títulos institucionales. Sin Syne ni fuentes display."
      >
        <Card>
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.14em", color: "#6C0606", textTransform: "uppercase" }}>
                Kicker · 11/700/0.14em
              </div>
            </div>
            <div>
              <div style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                Sistema Integral de Fiscalización del Transporte Municipal
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: 4 }}>H1 · 36/800/-0.03em</div>
            </div>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Catálogo de diseño del sistema
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: 4 }}>H2 · 24/700/-0.02em</div>
            </div>
            <div>
              <div style={{ fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                Subtítulo de sección institucional
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: 4 }}>H3 · 18/600/-0.01em</div>
            </div>
            <div>
              <div style={{ fontSize: "0.9375rem", color: "#18181b", lineHeight: 1.6 }}>
                Cuerpo de texto institucional. Se utiliza para descripciones, instrucciones y comunicados formales del sistema. La forma de tratamiento es siempre &ldquo;usted&rdquo;.
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: 4 }}>Body · 15/400/1.6</div>
            </div>
            <div>
              <div style={{ fontSize: "0.8125rem", color: "#52525b" }}>
                Texto auxiliar para etiquetas, ayudas contextuales y leyendas.
              </div>
              <div style={{ fontSize: "0.75rem", color: "#71717a", marginTop: 4 }}>Caption · 13/400</div>
            </div>
          </div>
        </Card>
      </Section>

      {/* ─── BUTTONS ─── */}
      <Section
        kicker="03 · Acciones"
        title="Botones"
        subtitle="Cinco variantes (primary, secondary, outline, ghost, danger) en tres tamaños. La variante primary usa el rojo institucional sobre blanco."
      >
        <Card>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Button variant="primary">Acceso al sistema</Button>
              <Button variant="secondary">Cancelar</Button>
              <Button variant="outline">Más opciones</Button>
              <Button variant="ghost">Omitir</Button>
              <Button variant="danger">Eliminar</Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Button size="sm">Pequeño</Button>
              <Button size="md">Mediano</Button>
              <Button size="lg">Grande</Button>
              <Button loading>Procesando</Button>
              <Button disabled>Deshabilitado</Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Button variant="primary">
                Continuar <ArrowRight size={16} />
              </Button>
              <Button variant="outline">
                <Search size={16} /> Buscar registros
              </Button>
            </div>
          </div>
        </Card>
      </Section>

      {/* ─── BADGES + STATUS ─── */}
      <Section
        kicker="04 · Indicadores"
        title="Badges, estados y roles"
        subtitle="Píldoras semánticas para estados de cuenta, condición vehicular y nivel de acceso del usuario."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <Card>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#52525b", marginBottom: 10 }}>Estado de cuenta</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["activo", "inactivo", "pendiente", "suspendido", "info", "gold"] as BadgeVariant[]).map(v => (
                <Badge key={v} variant={v}>{v}</Badge>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#52525b", marginBottom: 10 }}>Condición vehicular</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <StatusPill variant="apto">Apto</StatusPill>
              <StatusPill variant="riesgo">En riesgo</StatusPill>
              <StatusPill variant="no_apto">No apto</StatusPill>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#52525b", marginBottom: 10 }}>Roles del sistema</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <RolePill kind="super" label="Super Administrador" />
              <RolePill kind="admin" label="Administrador" />
              <RolePill kind="fiscalizador" label="Fiscalizador" />
              <RolePill kind="transportista" label="Transportista" />
              <RolePill kind="publico" label="Ciudadano" />
            </div>
          </Card>
        </div>
      </Section>

      {/* ─── CARDS ─── */}
      <Section
        kicker="05 · Superficies"
        title="Cards"
        subtitle="Contenedor base para módulos del dashboard y secciones de formulario. Soporta variante de acento institucional."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <Card>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Card por defecto</h3>
            <p style={{ fontSize: "0.875rem", color: "#71717a", margin: "6px 0 0" }}>
              Fondo blanco con borde neutral. Para contenido informativo estándar.
            </p>
          </Card>
          <Card accent="gold">
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Card con acento</h3>
            <p style={{ fontSize: "0.875rem", color: "#52525b", margin: "6px 0 0" }}>
              Fondo institucional rojo claro. Para destacar accesos rápidos o información preferente.
            </p>
          </Card>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FBEAEA", color: "#6C0606", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QrCode size={20} />
              </div>
              <div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700 }}>Verificación QR</div>
                <div style={{ fontSize: "0.8125rem", color: "#71717a" }}>1.247 escaneos hoy</div>
              </div>
            </div>
            <Button size="sm" variant="outline">Abrir módulo</Button>
          </Card>
        </div>
      </Section>

      {/* ─── KPI STRIP ─── */}
      <Section
        kicker="06 · Métricas"
        title="Tira de KPIs"
        subtitle="Bloques numéricos para encabezados de dashboards. Etiqueta en rojo institucional, valor en escala display."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <KpiCell label="Vehículos activos" value="3.482" hint="+ 124 esta semana" />
          <KpiCell label="Fiscalizaciones" value="12.907" hint="Acumulado del mes" />
          <KpiCell label="Reportes ciudadanos" value="218" hint="Pendientes de revisión" />
          <KpiCell label="Cumplimiento" value="94,2 %" hint="Promedio mensual" />
        </div>
      </Section>

      {/* ─── INPUTS ─── */}
      <Section
        kicker="07 · Formularios"
        title="Campos de entrada"
        subtitle="Inputs nativos con estilos institucionales. Se usan en flujos de autenticación, registro y configuración de cuenta."
      >
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <FormField label="Correo institucional" hint="Solo dominios autorizados">
              <input type="email" placeholder="usuario@municipalidad.gob.pe" style={INPUT_STYLE} />
            </FormField>
            <FormField label="Contraseña">
              <input type="password" placeholder="Ingrese su contraseña" style={INPUT_STYLE} />
            </FormField>
            <FormField label="Placa vehicular" hint="Formato: ABC-123">
              <input type="text" placeholder="V1A-234" style={INPUT_STYLE} />
            </FormField>
            <FormField label="Municipalidad">
              <select style={INPUT_STYLE} defaultValue="">
                <option value="" disabled>Seleccione una opción</option>
                <option>Cusco</option>
                <option>San Sebastián</option>
                <option>San Jerónimo</option>
              </select>
            </FormField>
          </div>
        </Card>
      </Section>

      {/* ─── PAGE HEADER + EMPTY STATE ─── */}
      <Section
        kicker="08 · Plantillas"
        title="Encabezado de página y estado vacío"
        subtitle="Patrones recurrentes en cada vista del dashboard."
      >
        <div style={{ display: "grid", gap: 18 }}>
          <Card>
            <PageHeader
              kicker="Módulo de fiscalización"
              title="Vehículos registrados"
              subtitle="Listado de unidades autorizadas para circulación dentro de la jurisdicción municipal."
              action={<Button variant="primary" size="sm">Nuevo vehículo</Button>}
            />
          </Card>

          <EmptyState
            icon={<Inbox size={22} />}
            title="No hay registros aún"
            subtitle="Cuando se registren vehículos en esta municipalidad, aparecerán aquí ordenados por fecha."
            cta={<Button variant="primary" size="sm">Registrar vehículo</Button>}
          />
        </div>
      </Section>

      {/* ─── ICONOGRAFÍA INSTITUCIONAL ─── */}
      <Section
        kicker="09 · Iconografía"
        title="Pictogramas funcionales"
        subtitle="Lucide React como librería única. Tamaño base 20px, trazo 1.75px en cabeceras y 1.5px en cuerpo."
      >
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 }}>
            {[
              { icon: <QrCode size={22} />,    label: "QR" },
              { icon: <FileText size={22} />,  label: "Documentos" },
              { icon: <Users size={22} />,     label: "Usuarios" },
              { icon: <ShieldCheck size={22} />, label: "Apto" },
              { icon: <AlertTriangle size={22} />, label: "Riesgo" },
              { icon: <Ban size={22} />,       label: "No apto" },
              { icon: <Building2 size={22} />, label: "Municipalidad" },
              { icon: <MapPin size={22} />,    label: "Ubicación" },
            ].map(({ icon, label }) => (
              <div key={label} style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "16px 10px",
                border: "1.5px solid #e4e4e7",
                borderRadius: 12,
                background: "#fff",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "#FBEAEA", color: "#6C0606",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {icon}
                </div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#52525b" }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ─── TOKENS CENTRALIZADOS ─── */}
      <Section
        kicker="10 · Tokens"
        title="Spacing, radius y breakpoints"
        subtitle="Escala de 4 px sincronizada entre web (CSS + TypeScript) y Flutter (AppSpacing / AppRadius / AppBreakpoints). Importa desde @/lib/tokens en componentes nuevos."
      >
        <div style={{ display: "grid", gap: 18 }}>
          {/* Spacing scale */}
          <Card>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: palette.ink6, marginBottom: 14 }}>
              Spacing scale (4 px grid)
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {([
                ["xs",   spacing.xs,    "Gap icon ↔ label"],
                ["sm",   spacing.sm,    "Chips, badges densos"],
                ["md",   spacing.md,    "Campos de formulario"],
                ["base", spacing.base,  "Padding base de cards"],
                ["lg",   spacing.lg,    "Padding cómodo"],
                ["xl",   spacing.xl,    "Padding principal"],
                ["2xl",  spacing["2xl"],"Bloques mayores"],
                ["3xl",  spacing["3xl"],"Secciones de landing"],
                ["4xl",  spacing["4xl"],"Mobile máximo"],
              ] as const).map(([name, val, hint]) => (
                <div key={name} className="ds-token-row" style={{ borderBottom: `1px solid ${palette.ink2}` }}>
                  <span style={{ color: palette.primary, fontWeight: 600 }}>{name}</span>
                  <span style={{ color: palette.ink6 }}>{val} px</span>
                  <span style={{
                    height: 14,
                    width: val,
                    background: palette.primary,
                    borderRadius: 2,
                    maxWidth: "100%",
                  }} />
                  <span style={{ color: palette.ink5, fontFamily: "var(--font-inter), Inter, sans-serif" }}>
                    {hint}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Radius scale */}
          <Card>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: palette.ink6, marginBottom: 14 }}>
              Radius scale
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {([
                ["xs",   radius.xs],
                ["sm",   radius.sm],
                ["md",   radius.md],
                ["lg",   radius.lg],
                ["xl",   radius.xl],
                ["2xl",  radius["2xl"]],
                ["full", 999],
              ] as const).map(([name, val]) => (
                <div key={name} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}>
                  <div style={{
                    width: 64,
                    height: 64,
                    background: palette.primaryBg,
                    border: `1.5px solid ${palette.primaryBorder}`,
                    borderRadius: val,
                  }} />
                  <span style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "0.75rem",
                    color: palette.ink6,
                  }}>
                    {name} · {val === 999 ? "full" : `${val}px`}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Breakpoints */}
          <Card>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: palette.ink6, marginBottom: 14 }}>
              Breakpoints unificados (mobile-first)
            </div>
            <div style={{ display: "grid", gap: 0 }}>
              {([
                ["mobileSm", breakpoints.mobileSm, "iPhone SE"],
                ["mobileLg", breakpoints.mobileLg, "Pixel / Android"],
                ["tablet",   breakpoints.tablet,   "iPad portrait"],
                ["desktop",  breakpoints.desktop,  "Laptop pequeño"],
                ["wide",     breakpoints.wide,     "Desktop estándar"],
                ["xl",       breakpoints.xl,       "Pantalla grande"],
              ] as const).map(([name, val, hint]) => (
                <div key={name} className="ds-token-row ds-token-row--bp" style={{ borderBottom: `1px solid ${palette.ink2}`, padding: "8px 0" }}>
                  <span style={{ color: palette.primary, fontWeight: 600 }}>{name}</span>
                  <span style={{ color: palette.ink6 }}>≥ {val}px</span>
                  <span style={{ color: palette.ink5, fontFamily: "var(--font-inter), Inter, sans-serif" }}>
                    {hint}
                  </span>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 12,
              padding: 12,
              background: palette.ink1,
              borderRadius: 8,
              fontSize: "0.75rem",
              color: palette.ink6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              lineHeight: 1.6,
            }}>
              Web: <span style={{ color: palette.primary }}>{`import { breakpoints, mq } from "@/lib/tokens"`}</span>
              <br />
              Flutter: <span style={{ color: palette.primary }}>AppBreakpoints.isTabletUp(context)</span>
            </div>
          </Card>
        </div>
      </Section>

      <div style={{ marginTop: 32, fontSize: "0.8125rem", color: "#a1a1aa", textAlign: "center" }}>
        Catálogo interno de diseño · Sistema de Fiscalización del Transporte Municipal · UNSAAC
      </div>
    </main>
  );
}

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  border: "1.5px solid #e4e4e7",
  borderRadius: 10,
  fontSize: "0.9375rem",
  color: "#18181b",
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#18181b" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: "0.75rem", color: "#71717a" }}>{hint}</span>}
    </label>
  );
}
