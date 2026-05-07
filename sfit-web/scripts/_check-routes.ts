import { config } from "dotenv";
config({ path: ".env.local" });
import mongoose from "mongoose";
import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const loose = { strict: false } as const;
  const Route = mongoose.models.Route ?? mongoose.model("Route", new mongoose.Schema({}, { ...loose, collection: "routes" }));
  const FleetEntry = mongoose.models.FleetEntry ?? mongoose.model("FleetEntry", new mongoose.Schema({}, { ...loose, collection: "fleetentries" }));
  const Municipality = mongoose.models.Municipality ?? mongoose.model("Municipality", new mongoose.Schema({}, { ...loose, collection: "municipalities" }));

  const total = await Route.countDocuments({});
  const byStatus = await Route.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  const sample = await Route.find({}).limit(15).select("name code status municipalityId waypoints direction createdAt").lean() as any[];
  const muniMap = new Map<string, string>();
  for (const m of (await Municipality.find({}).select("name").lean()) as any[]) muniMap.set(String(m._id), m.name);

  console.log(`Routes total: ${total}`);
  console.log("By status:", JSON.stringify(byStatus));
  console.log("\nMuestra (hasta 15):");
  for (const r of sample) {
    const wp = (r.waypoints ?? []).length;
    const wp0 = wp > 0 ? `(${(r.waypoints[0] as any).lat?.toFixed(4)}, ${(r.waypoints[0] as any).lng?.toFixed(4)})` : "—";
    console.log(`  [${r.status ?? "—"}] ${r.code ?? "—"} · ${r.name ?? "—"} | muni: ${muniMap.get(String(r.municipalityId)) ?? "—"} | wp: ${wp} ${wp0}`);
  }

  console.log("\n=== FleetEntries con routeId (top 15 por count) ===");
  const fe = await FleetEntry.aggregate([
    { $match: { routeId: { $exists: true, $ne: null } } },
    { $group: { _id: { route: "$routeId", status: "$status" }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 15 },
  ]);
  for (const x of fe) {
    const r = await Route.findById(x._id.route).select("code name status").lean() as any;
    console.log(`  ${r?.code ?? "—"} · ${r?.name ?? "(ruta no existe)"} [${r?.status ?? "—"}] | turno status: ${x._id.status} | turnos: ${x.n}`);
  }

  await mongoose.disconnect();
})();
