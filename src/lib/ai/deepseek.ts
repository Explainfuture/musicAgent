type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function callDeepSeekJson<T>(messages: DeepSeekMessage[]): Promise<T> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages,
      temperature: 0.6,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed: ${response.status}`);
  }

  const data = (await response.json()) as DeepSeekResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek response is empty.");
  }

  return JSON.parse(content) as T;
}
