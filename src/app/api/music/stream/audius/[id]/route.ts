import { NextResponse } from "next/server";

const AUDIUS_APP_NAME = "musicAgentMvp";
const STREAM_TIMEOUT_MS = 4500;

function isAllowedAudiusStreamUrl(url: string) {
  if (!/^https:\/\/.+/i.test(url)) return false;

  const upstreamHost = new URL(url).hostname;
  return [
    "audius",
    "creatornode",
    "open-audio-validator",
    "figment",
    "staked",
    "altego",
    "theblueprint",
    "rickyrombo",
  ].some((allowedPart) => upstreamHost.includes(allowedPart));
}

function buildMirrorUrl(signedUrl: string, mirror: string) {
  const original = new URL(signedUrl);
  const mirrorUrl = new URL(mirror);
  original.protocol = mirrorUrl.protocol;
  original.host = mirrorUrl.host;
  return original.toString();
}

async function fetchWithTimeout(url: string, rangeHeader: string | null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

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

  if (!upstreamUrl || !isAllowedAudiusStreamUrl(upstreamUrl)) {
    return NextResponse.json({ error: "Invalid Audius stream url." }, { status: 400 });
  }

  const mirrorUrls = signedUrl
    ? searchParams
        .getAll("mirror")
        .flatMap((mirror) => {
          try {
            return [buildMirrorUrl(signedUrl, mirror)];
          } catch {
            return [];
          }
        })
        .filter(isAllowedAudiusStreamUrl)
    : [];
  const candidates = [upstreamUrl, ...mirrorUrls];
  const rangeHeader = request.headers.get("range");

  for (const candidate of candidates) {
    try {
      const upstream = await fetchWithTimeout(candidate, rangeHeader);

      if (!upstream.ok || !upstream.body) {
        continue;
      }

      const headers = new Headers({
        "Content-Type": upstream.headers.get("Content-Type") || "audio/mpeg",
        "Cache-Control": "public, max-age=300",
        "Accept-Ranges": upstream.headers.get("Accept-Ranges") || "bytes",
      });
      const contentLength = upstream.headers.get("Content-Length");
      const contentRange = upstream.headers.get("Content-Range");

      if (contentLength) headers.set("Content-Length", contentLength);
      if (contentRange) headers.set("Content-Range", contentRange);

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch {
      // Try the next Audius mirror quickly instead of blocking playback.
    }
  }

  return NextResponse.json(
    { error: "Audius stream mirrors are unavailable." },
    { status: 502 },
  );
}
