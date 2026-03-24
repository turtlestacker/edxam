import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  const { subscription, message } = await req.json();

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title: "Revision Tracker", body: message }));
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: "Push failed" }, { status });
  }
}
