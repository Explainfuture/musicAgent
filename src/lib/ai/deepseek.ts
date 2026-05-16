type DeepSeekMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason?: string;
  }>;
};

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

function getDeepSeekApiKey(apiKey?: string) {
  const resolvedKey = apiKey?.trim() || process.env.DEEPSEEK_API_KEY;
  if (!resolvedKey) throw new Error("DEEPSEEK_API_KEY is not configured.");
  return resolvedKey;
}

// ── JSON mode (existing) ──────────────────────────────

export async function callDeepSeekJson<T>(messages: DeepSeekMessage[], apiKey?: string): Promise<T> {
  const resolvedKey = getDeepSeekApiKey(apiKey);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolvedKey}`,
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
  if (!content) throw new Error("DeepSeek response is empty.");

  return JSON.parse(content) as T;
}

// ── Tool calling mode (new) ─────────────────────────────

export async function callDeepSeekWithTools(input: {
  messages: DeepSeekMessage[];
  tools: ToolDefinition[];
  toolChoice?: "auto" | "required" | { type: "function"; function: { name: string } };
  apiKey?: string;
}): Promise<{
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  content: string | null;
}> {
  const resolvedKey = getDeepSeekApiKey(input.apiKey);

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolvedKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.toolChoice || "auto",
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek tool call failed: ${response.status}`);
  }

  const data = (await response.json()) as DeepSeekResponse;
  const choice = data.choices?.[0];

  const toolCalls = (choice?.message?.tool_calls || []).map((tc) => ({
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
  }));

  return {
    toolCalls,
    content: choice?.message?.content || null,
  };
}
