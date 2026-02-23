/**
 * Groq API client for chat completions.
 * Used by the extension for ATS-optimized resume and cover letter generation.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface GroqMessage {
  role: string;
  content: string;
}

export interface CallGroqAPIOptions {
  messages: GroqMessage[];
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Calls Groq chat completions API. Returns the assistant message content or throws on error.
 */
export async function callGroqAPI(
  messages: GroqMessage[],
  apiKey: string,
  model: string = 'meta-llama/llama-4-scout-17b-16e-instruct',
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 4096,
      top_p: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}
