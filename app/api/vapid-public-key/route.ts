import { NextResponse } from "next/server";

export function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
  return NextResponse.json({ publicKey: key });
}
