/**
 * RF-18: Templates HTML para emails transaccionales de SFIT.
 */

const baseStyle = `
  font-family: Inter, Arial, sans-serif;
  background-color: #f8fafc;
  margin: 0;
  padding: 0;
`;

const cardStyle = `
  background-color: #ffffff;
  border-radius: 8px;
  max-width: 560px;
  margin: 40px auto;
  padding: 36px 40px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
`;

const headingStyle = `
  color: #0A1628;
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 16px 0;
`;

const textStyle = `
  color: #374151;
  font-size: 15px;
  line-height: 1.6;
  margin: 0 0 12px 0;
`;

const labelStyle = `
  color: #6B7280;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const valueStyle = `
  color: #0A1628;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
`;

const badgeStyle = (color: string) => `
  display: inline-block;
  background-color: ${color};
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  margin-top: 4px;
`;

const dividerStyle = `
  border: none;
  border-top: 1px solid #E5E7EB;
  margin: 24px 0;
`;

const footerStyle = `
  color: #9CA3AF;
  font-size: 12px;
  text-align: center;
  margin-top: 8px;
`;

function wrapTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="${baseStyle}">
  <div style="${cardStyle}">
    <div style="margin-bottom: 24px;">
      <span style="color: #0A1628; font-size: 18px; font-weight: 800; letter-spacing: -0.5px;">SFIT</span>
      <span style="color: #6B7280; font-size: 13px; margin-left: 8px;">Sistema Fiscal de Inspección de Transporte</span>
    </div>
    ${body}
    <hr style="${dividerStyle}" />
    <p style="${footerStyle}">SFIT &copy; 2026 — Este es un mensaje automático, no responder.</p>
  </div>
</body>
</html>`;
}

export function sanctionEmailHtml(params: {
  companyName: string;
  plate: string;
  faultType: string;
  amountSoles: number;
}): string {
  const { companyName, plate, faultType, amountSoles } = params;
  const formattedAmount = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amountSoles);

  const body = `
    <h1 style="${headingStyle}">Notificación de Sanción Emitida</h1>
    <p style="${textStyle}">
      Se ha registrado una nueva sanción para la empresa <strong>${companyName}</strong>
      en el Sistema Fiscal de Inspección de Transporte (SFIT).
    </p>
    <div style="background-color: #FFF7ED; border-left: 4px solid #F97316; border-radius: 4px; padding: 16px 20px; margin: 20px 0;">
      <p style="${labelStyle}">Vehículo</p>
      <p style="${valueStyle}">${plate}</p>
      <p style="${labelStyle}">Tipo de infracción</p>
      <p style="${valueStyle}">${faultType}</p>
      <p style="${labelStyle}">Monto de la sanción</p>
      <p style="${valueStyle}">${formattedAmount}</p>
    </div>
    <p style="${textStyle}">
      Puede presentar una apelación a través del portal SFIT dentro de los plazos establecidos
      por la normativa vigente.
    </p>
  `;
  return wrapTemplate(body);
}

export function appealResolvedEmailHtml(params: {
  companyName: string;
  plate: string;
  resolution: string; // 'confirmada' | 'reducida' | 'anulada'
  newAmount?: number;
}): string {
  const { companyName, plate, resolution, newAmount } = params;

  const resolutionColors: Record<string, string> = {
    confirmada: '#EF4444',
    reducida: '#F97316',
    anulada: '#22C55E',
  };
  const badgeColor = resolutionColors[resolution] ?? '#6B7280';

  const resolutionLabels: Record<string, string> = {
    confirmada: 'Sanción confirmada',
    reducida: 'Sanción reducida',
    anulada: 'Sanción anulada',
  };
  const resolutionLabel = resolutionLabels[resolution] ?? resolution;

  const amountSection = newAmount !== undefined
    ? `<p style="${labelStyle}">Nuevo monto</p>
       <p style="${valueStyle}">${new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(newAmount)}</p>`
    : '';

  const body = `
    <h1 style="${headingStyle}">Resolución de Apelación</h1>
    <p style="${textStyle}">
      La apelación presentada por <strong>${companyName}</strong> respecto al vehículo
      <strong>${plate}</strong> ha sido resuelta.
    </p>
    <div style="background-color: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px 20px; margin: 20px 0;">
      <p style="${labelStyle}">Vehículo</p>
      <p style="${valueStyle}">${plate}</p>
      <p style="${labelStyle}">Resolución</p>
      <div style="margin-bottom: 12px;">
        <span style="${badgeStyle(badgeColor)}">${resolutionLabel}</span>
      </div>
      ${amountSection}
    </div>
    <p style="${textStyle}">
      Para más detalles sobre esta resolución, ingrese al portal SFIT con sus credenciales.
    </p>
  `;
  return wrapTemplate(body);
}

export function accountApprovedEmailHtml(params: {
  userName: string;
  role: string;
}): string {
  const { userName, role } = params;

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Administrador',
    admin_provincial: 'Administrador Provincial',
    admin_municipal: 'Administrador Municipal',
    fiscal: 'Fiscal',
    operador: 'Operador',
    conductor: 'Conductor',
    ciudadano: 'Ciudadano',
  };
  const roleLabel = roleLabels[role] ?? role;

  const body = `
    <h1 style="${headingStyle}">Solicitud Aprobada</h1>
    <p style="${textStyle}">
      Hola <strong>${userName}</strong>, nos complace informarte que tu solicitud de acceso
      al Sistema Fiscal de Inspección de Transporte (SFIT) ha sido <strong>aprobada</strong>.
    </p>
    <div style="background-color: #F0FDF4; border-left: 4px solid #22C55E; border-radius: 4px; padding: 16px 20px; margin: 20px 0;">
      <p style="${labelStyle}">Rol asignado</p>
      <div style="margin-top: 4px;">
        <span style="${badgeStyle('#22C55E')}">${roleLabel}</span>
      </div>
    </div>
    <p style="${textStyle}">
      Ya puedes iniciar sesión con tus credenciales y acceder a todas las funcionalidades
      correspondientes a su rol.
    </p>
    <p style="${textStyle}">Bienvenido/a a SFIT.</p>
  `;
  return wrapTemplate(body);
}

export function accountRejectedEmailHtml(params: {
  userName: string;
  reason?: string;
}): string {
  const { userName, reason } = params;

  const reasonSection = reason
    ? `<div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 4px; padding: 16px 20px; margin: 20px 0;">
         <p style="${labelStyle}">Motivo</p>
         <p style="${valueStyle}">${reason}</p>
       </div>`
    : '';

  const body = `
    <h1 style="${headingStyle}">Solicitud No Aprobada</h1>
    <p style="${textStyle}">
      Hola <strong>${userName}</strong>, te informamos que tu solicitud de acceso
      al Sistema Fiscal de Inspección de Transporte (SFIT) no ha podido ser aprobada en esta ocasión.
    </p>
    ${reasonSection}
    <p style="${textStyle}">
      Si consideras que hubo un error o deseas más información, comunícate con el administrador
      de su municipalidad o provincia correspondiente.
    </p>
  `;
  return wrapTemplate(body);
}
