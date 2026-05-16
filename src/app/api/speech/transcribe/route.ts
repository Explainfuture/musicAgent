import crypto from "node:crypto";
import { NextResponse } from "next/server";

const ENDPOINT = "asr.tencentcloudapi.com";
const SERVICE = "asr";
const ACTION = "SentenceRecognition";
const VERSION = "2019-06-14";

type TencentAsrResponse = {
  Response?: {
    Result?: string;
    Error?: {
      Code?: string;
      Message?: string;
    };
  };
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function signRequest(input: {
  payload: string;
  secretId: string;
  secretKey: string;
  timestamp: number;
  date: string;
}) {
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${ENDPOINT}\nx-tc-action:${ACTION.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(input.payload),
  ].join("\n");

  const credentialScope = `${input.date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    input.timestamp.toString(),
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const secretDate = hmac(`TC3${input.secretKey}`, input.date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = crypto.createHmac("sha256", secretSigning).update(stringToSign).digest("hex");

  return `TC3-HMAC-SHA256 Credential=${input.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const formSecretId = form.get("tencentSecretId");
  const formSecretKey = form.get("tencentSecretKey");
  const formRegion = form.get("tencentRegion");
  const formEngine = form.get("tencentAsrEngine");
  const secretId = (typeof formSecretId === "string" ? formSecretId.trim() : "") || process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = (typeof formSecretKey === "string" ? formSecretKey.trim() : "") || process.env.TENCENTCLOUD_SECRET_KEY;
  const region = (typeof formRegion === "string" ? formRegion.trim() : "") || process.env.TENCENTCLOUD_REGION || "ap-guangzhou";
  const engine = (typeof formEngine === "string" ? formEngine.trim() : "") || process.env.TENCENT_ASR_ENGINE || "16k_zh";

  if (!secretId || !secretKey) {
    return NextResponse.json(
      { error: "TENCENTCLOUD_SECRET_ID or TENCENTCLOUD_SECRET_KEY is not configured." },
      { status: 501 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }

  const audio = Buffer.from(await file.arrayBuffer());
  if (audio.length === 0) {
    return NextResponse.json({ error: "Audio file is empty." }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({
    EngSerViceType: engine,
    SourceType: 1,
    VoiceFormat: "wav",
    UsrAudioKey: `music-agent-${timestamp}-${crypto.randomUUID()}`,
    Data: audio.toString("base64"),
    DataLen: audio.length,
  });

  const response = await fetch(`https://${ENDPOINT}`, {
    method: "POST",
    headers: {
      Authorization: signRequest({ payload, secretId, secretKey, timestamp, date }),
      "Content-Type": "application/json; charset=utf-8",
      Host: ENDPOINT,
      "X-TC-Action": ACTION,
      "X-TC-Timestamp": timestamp.toString(),
      "X-TC-Version": VERSION,
      "X-TC-Region": region,
    },
    body: payload,
  });

  const data = (await response.json().catch(() => null)) as TencentAsrResponse | null;
  const apiError = data?.Response?.Error;
  if (!response.ok || apiError) {
    return NextResponse.json(
      { error: apiError?.Message || `Tencent ASR failed: ${response.status}` },
      { status: response.ok ? 502 : response.status },
    );
  }

  const text = data?.Response?.Result?.trim() || "";
  if (!text) {
    return NextResponse.json({ error: "没有识别到语音内容。" }, { status: 422 });
  }

  return NextResponse.json({ text });
}
