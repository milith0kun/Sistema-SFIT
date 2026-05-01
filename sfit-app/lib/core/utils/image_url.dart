/// Normaliza URLs de imágenes que pueden venir mal formadas del backend.
///
/// Antes del fix de `/api/uploads/reports/route.ts` (commit 9f9a139), las
/// URLs de imágenes guardadas en `CitizenReport.imageUrls` se construían
/// con `request.url`, que detrás del proxy de Cloudflare/Dokploy reflejaba
/// el origen interno del socket (`https://0.0.0.0:3000`) en vez del host
/// público. Esos reportes quedaron con URLs inalcanzables desde el cliente.
///
/// Esta función reemplaza esos hosts internos por el host público de
/// producción para que las imágenes viejas se sigan viendo, sin necesidad
/// de migrar la BD.
String normalizeImageUrl(String url) {
  if (url.isEmpty) return url;
  // Hosts internos conocidos que el cliente no puede alcanzar.
  const brokenHosts = [
    'https://0.0.0.0:3000',
    'http://0.0.0.0:3000',
    'https://localhost:3000',
    'http://localhost:3000',
    'https://127.0.0.1:3000',
    'http://127.0.0.1:3000',
  ];
  for (final h in brokenHosts) {
    if (url.startsWith(h)) {
      return 'https://sfit.ecosdelseo.com${url.substring(h.length)}';
    }
  }
  return url;
}
