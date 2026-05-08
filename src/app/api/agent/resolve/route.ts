import { NextResponse } from "next/server";
import { resolveMusicAgent } from "@/lib/agent/resolveMusic";
import type { AgentResolveRequest } from "@/types/agent";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentResolveRequest;
    const response = await resolveMusicAgent(body);
    return NextResponse.json(response);
  } catch (error) {
    const status = error instanceof Error && error.name === "NoPlayableTrack" ? 404 : 500;
    return NextResponse.json(
      { error: (error as Error).message || "Agent 暂时没接住。" },
      { status },
    );
  }
}
