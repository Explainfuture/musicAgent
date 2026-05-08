import { NextResponse } from "next/server";
import { fetchQQMusicLyricData } from "@/lib/music/qqmusic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const id = searchParams.get("id");

  if (source !== "qqmusic" || !id) {
    return NextResponse.json(
      { error: "Only QQ Music lyrics are supported." },
      { status: 400 },
    );
  }

  const songmid = id.replace("qqmusic_", "");
  const lyricData = await fetchQQMusicLyricData(songmid);

  return NextResponse.json(lyricData);
}
