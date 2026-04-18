/**
 * Next.js instrumentation — se ejecuta UNA VEZ al arrancar el servidor,
 * antes de cualquier request. Aquí forzamos los DNS servers globales para
 * toda la aplicación Node.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
    dns.promises.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  }
}
