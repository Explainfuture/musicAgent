import { NextResponse } from "next/server";

const AUDIUS_APP_NAME = "musicAgentMvp";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const signedUrl = searchParams.get("url");
  const host = searchParams.get("host");
  const upstreamUrl =
    signedUrl ||
    (host
      ? `${host}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=${AUDIUS_APP_NAME}`
      : "");

  if (!upstreamUrl || !/^https:\/\/.+/i.test(upstreamUrl)) {
    return NextResponse.json({ error: "Invalid Audius stream url." }, { status: 400 });
  }

  const upstreamHost = new URL(upstreamUrl).hostname;
  const isAudiusHost = [
    "audius",
    "creatornode",
    "open-audio-validator",
    "figment",
    "staked",
    "altego",
  ].some((allowedPart) => upstreamHost.includes(allowedPart));

  if (!isAudiusHost) {
    return NextResponse.json({ error: "Unsupported Audius stream host." }, { status: 400 });
  }

  const upstream = await fetch(upstreamUrl, { redirect: "follow" });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Audius stream failed: ${upstream.status}` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "public, max-age=300",
    },
  });
}
