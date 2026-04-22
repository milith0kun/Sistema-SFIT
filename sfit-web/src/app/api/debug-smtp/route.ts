import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    smtp_user: process.env.SMTP_USER ? "✅ " + process.env.SMTP_USER : "❌ vacío",
    smtp_pass: process.env.SMTP_PASS ? "✅ configurado" : "❌ vacío",
  });
}
