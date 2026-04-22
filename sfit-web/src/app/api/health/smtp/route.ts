import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    smtp_user: process.env.SMTP_USER ? "ok:" + process.env.SMTP_USER : "vacio",
    smtp_pass: process.env.SMTP_PASS ? "ok" : "vacio",
  });
}
