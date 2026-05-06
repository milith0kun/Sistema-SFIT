import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("@/models/Vehicle", () => ({ Vehicle: {} }));
vi.mock("@/models/FleetEntry", () => ({ FleetEntry: { find: vi.fn() } }));
vi.mock("@/models/Route", () => ({ Route: { find: vi.fn() } }));

import { FleetEntry } from "@/models/FleetEntry";
import { Route } from "@/models/Route";

beforeEach(() => vi.clearAllMocks());

const MUNI = "507f1f77bcf86cd799439011";
const ROUTE_A = "507f1f77bcf86cd799439101";
const ROUTE_B = "507f1f77bcf86cd799439102";

function req(search: string) {
  return new NextRequest(`http://localhost/api/public/rutas-activas${search}`);
}

function chainPopulate(result: unknown) {
  return {
    populate: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function chainSelect(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

describe("GET /api/public/rutas-activas — parámetros", () => {
  it("retorna empty si falta municipalityId", async () => {
    const res = await GET(req(""));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.items).toEqual([]);
  });

  it("retorna empty si municipalityId es inválido", async () => {
    const res = await GET(req("?municipalityId=not-an-objectid"));
    const json = await res.json();
    expect(json.data.items).toEqual([]);
  });
});

describe("GET /api/public/rutas-activas — agregación por ruta", () => {
  it("agrupa buses por routeId y devuelve count + lista", async () => {
    (FleetEntry.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainPopulate([
        {
          _id: "bus1",
          routeId: ROUTE_A,
          vehicleId: { plate: "CUS-001" },
          currentLocation: { lat: -13.52, lng: -71.97 },
          visitedStops: [],
        },
        {
          _id: "bus2",
          routeId: ROUTE_A,
          vehicleId: { plate: "CUS-002" },
          currentLocation: { lat: -13.521, lng: -71.971 },
          visitedStops: [{ stopIndex: 0 }],
        },
        {
          _id: "bus3",
          routeId: ROUTE_B,
          vehicleId: { plate: "CUS-003" },
          currentLocation: { lat: -13.52, lng: -71.96 },
          visitedStops: [],
        },
      ]),
    );

    (Route.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainSelect([
        {
          _id: ROUTE_A,
          name: "Ruta A",
          code: "RA",
          waypoints: [
            { order: 0, lat: -13.52, lng: -71.97, label: "Inicio" },
            { order: 1, lat: -13.51, lng: -71.96, label: "Plaza" },
            { order: 2, lat: -13.50, lng: -71.95, label: "Fin" },
          ],
          polylineGeometry: { coords: [[-13.52, -71.97], [-13.50, -71.95]] },
        },
        {
          _id: ROUTE_B,
          name: "Ruta B",
          code: "RB",
          waypoints: [
            { order: 0, lat: -13.52, lng: -71.96, label: "Inicio" },
            { order: 1, lat: -13.50, lng: -71.94, label: "Fin" },
          ],
        },
      ]),
    );

    const res = await GET(req(`?municipalityId=${MUNI}`));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.items).toHaveLength(2);

    const ra = json.data.items.find((r: { routeId: string }) => r.routeId === ROUTE_A);
    const rb = json.data.items.find((r: { routeId: string }) => r.routeId === ROUTE_B);

    expect(ra.activeBusCount).toBe(2);
    expect(rb.activeBusCount).toBe(1);
    expect(ra.buses).toHaveLength(2);
    expect(ra.waypoints).toHaveLength(3);
    expect(ra.polylineCoords).toEqual([[-13.52, -71.97], [-13.50, -71.95]]);
  });

  it("ordena por count descendente sin coords del usuario", async () => {
    (FleetEntry.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainPopulate([
        { _id: "b1", routeId: ROUTE_A, vehicleId: { plate: "A" }, currentLocation: { lat: 0, lng: 0 }, visitedStops: [] },
        { _id: "b2", routeId: ROUTE_B, vehicleId: { plate: "B" }, currentLocation: { lat: 0, lng: 0 }, visitedStops: [] },
        { _id: "b3", routeId: ROUTE_B, vehicleId: { plate: "C" }, currentLocation: { lat: 0, lng: 0 }, visitedStops: [] },
        { _id: "b4", routeId: ROUTE_B, vehicleId: { plate: "D" }, currentLocation: { lat: 0, lng: 0 }, visitedStops: [] },
      ]),
    );
    (Route.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainSelect([
        { _id: ROUTE_A, name: "A", waypoints: [{ order: 0, lat: 0, lng: 0 }, { order: 1, lat: 0, lng: 0 }] },
        { _id: ROUTE_B, name: "B", waypoints: [{ order: 0, lat: 0, lng: 0 }, { order: 1, lat: 0, lng: 0 }] },
      ]),
    );

    const res = await GET(req(`?municipalityId=${MUNI}`));
    const json = await res.json();
    expect(json.data.items[0].routeId).toBe(ROUTE_B); // 3 buses
    expect(json.data.items[1].routeId).toBe(ROUTE_A); // 1 bus
  });
});

describe("GET /api/public/rutas-activas — con coords del usuario", () => {
  it("calcula nearestStop, etaToUserStopSeconds y ordena por proximidad", async () => {
    // Bus en (lat -13.52, lng -71.97), waypoints sucesivos hacia el este.
    // El usuario está cerca del waypoint de orden 2.
    (FleetEntry.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainPopulate([
        {
          _id: "bus1",
          routeId: ROUTE_A,
          vehicleId: { plate: "CUS-001" },
          currentLocation: { lat: -13.52, lng: -71.97, speed: 5 },
          visitedStops: [{ stopIndex: 0 }],
        },
      ]),
    );
    (Route.find as ReturnType<typeof vi.fn>).mockReturnValue(
      chainSelect([
        {
          _id: ROUTE_A,
          name: "Ruta A",
          waypoints: [
            { order: 0, lat: -13.52, lng: -71.97, label: "P0" },
            { order: 1, lat: -13.515, lng: -71.965, label: "P1" },
            { order: 2, lat: -13.510, lng: -71.960, label: "P2" },
          ],
        },
      ]),
    );

    const res = await GET(req(`?municipalityId=${MUNI}&lat=-13.510&lng=-71.960`));
    const json = await res.json();
    expect(json.data.items).toHaveLength(1);
    const ra = json.data.items[0];
    expect(ra.nearestStop?.stopIndex).toBe(2);
    expect(ra.etaToUserStopSeconds).toBeGreaterThan(0);
    expect(ra.closestBus?.distanceFromUserMeters).toBeGreaterThan(0);
  });
});
