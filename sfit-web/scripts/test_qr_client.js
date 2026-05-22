const crypto = require("crypto");
const http = require("http");

const secret = "sfit_qr_hmac_dev_2026";
const QR_VERSION = 1;

const vehicle = {
  id: "6a0f40981322a22a4623531f",
  pl: "B0Z816",
  mu: "69ee5002a1702346aefb20aa",
  ty: "transporte_interprovincial"
};

const ts = Math.floor(Date.now() / 1000);
const partial = { v: QR_VERSION, ...vehicle, ts };
const signingInput = `v${partial.v}|${partial.id}|${partial.pl}|${partial.mu}|${partial.ty}|${partial.ts}`;
const sig = crypto.createHmac("sha256", secret).update(signingInput).digest("hex");

const payload = { ...partial, sig };
const qrJson = JSON.stringify(payload);
const qrEncoded = encodeURIComponent(qrJson);

console.log("Payload JSON generado:\n", qrJson);
console.log("\nURL Encoded:\n", qrEncoded);

// Hacer la petición HTTP local
const url = `http://localhost:3000/api/public/vehiculo?qr=${qrEncoded}`;
console.log("\nConsultando a la API pública local...");

http.get(url, (res) => {
  let rawData = '';
  res.on('data', (chunk) => { rawData += chunk; });
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(rawData);
      console.log("\nRespuesta de la API:");
      console.log(JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.error("Error al parsear respuesta:", e.message);
      console.log("Raw response:", rawData);
    }
  });
}).on('error', (e) => {
  console.error("Error en request HTTP:", e.message);
});
