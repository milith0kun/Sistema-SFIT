import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { SfitCoin } from "@/models/SfitCoin";
import { User } from "@/models/User";
import { apiResponse, apiError, apiUnauthorized } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/guard";
import { getNivel } from "@/lib/coins/awardCoins";
import type { PipelineStage } from "mongoose";

const VALID_PERIODS = ["semana", "mes", "total"] as const;
type Period = (typeof VALID_PERIODS)[number];

function periodToDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "semana":
      now.setDate(now.getDate() - 7);
      return now;
    case "mes":
      now.setMonth(now.getMonth() - 1);
      return now;
    case "total":
      return new Date("2020-01-01");
  }
}

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (!session) return apiUnauthorized();

  const url = new URL(request.url);
  const period: Period = VALID_PERIODS.includes(url.searchParams.get("period") as Period)
    ? (url.searchParams.get("period") as Period)
    : "total";
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 100);
  const since = periodToDate(period);

  try {
    await connectDB();

    const pipeline: PipelineStage[] = [
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$userId",
          coins: { $sum: "$amount" },
        },
      },
      { $sort: { coins: -1 as const } },
      { $limit: limit },
    ];

    const agg = await SfitCoin.aggregate(pipeline);
    if (agg.length === 0) {
      return apiResponse({ items: [] });
    }

    const userIds = agg.map((a) => a._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select("name")
      .lean();

    const nameMap = new Map<string, string>();
    for (const u of users) {
      nameMap.set(String(u._id), u.name);
    }

    const items = agg.map((a) => {
      const balance = a.coins;
      const { nivel } = getNivel(balance);
      return {
        _id: String(a._id),
        name: nameMap.get(String(a._id)) ?? "—",
        coins: balance,
        nivel,
      };
    });

    return apiResponse({ items });
  } catch (error) {
    console.error("[ciudadano/ranking GET]", error);
    return apiError("Error al obtener ranking", 500);
  }
}