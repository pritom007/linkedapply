import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGroqAPI } from './groq-api.js';
import { stripCodeFences, extractFirstJsonObject } from './json-utils.js';

describe('callGroqAPI', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
    vi.restoreAllMocks();
  });

  it('sends POST to Groq API URL with correct headers and body', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Hello from Groq' } }],
        }),
    } as Response);

    const messages = [{ role: 'user', content: 'Say hello' }];
    const apiKey = 'test-api-key';

    const result = await callGroqAPI(messages, apiKey);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      }
    );

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse((callArgs?.[1] as any)?.body as string);
    expect(body).toMatchObject({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'user', content: 'Say hello' }],
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
    });

    expect(result).toBe('Hello from Groq');
  });

  it('uses custom model when provided', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'OK' } }],
        }),
    } as Response);

    await callGroqAPI(
      [{ role: 'user', content: 'Hi' }],
      'key',
      'llama-3.2-90b-preview'
    );

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse((callArgs?.[1] as any)?.body as string);
    expect(body.model).toBe('llama-3.2-90b-preview');
  });

  it('returns empty string when choices[0].message.content is missing', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [{}] }),
    } as Response);

    const result = await callGroqAPI(
      [{ role: 'user', content: 'Hi' }],
      'key'
    );

    expect(result).toBe('');
  });

  it('throws with message including status and body when response is not ok', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid API key'),
    } as Response);

    await expect(
      callGroqAPI([{ role: 'user', content: 'Hi' }], 'bad-key')
    ).rejects.toThrow('Groq API error: 401 - Invalid API key');
  });

  it('throws on 429 rate limit', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    } as Response);

    await expect(
      callGroqAPI([{ role: 'user', content: 'Hi' }], 'key')
    ).rejects.toThrow('Groq API error: 429 - Rate limit exceeded');
  });

  it('passes optional temperature and max_tokens when provided', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'Done' } }],
        }),
    } as Response);

    await callGroqAPI(
      [{ role: 'user', content: 'Hi' }],
      'key',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      { temperature: 0.3, max_tokens: 2048 }
    );

    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse((callArgs?.[1] as any)?.body as string);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(2048);
  });

  it('stripCodeFences removes markdown fences when present', () => {
    const input = '```json\n{"a":1}\n```';
    expect(stripCodeFences(input)).toBe('{"a":1}');
  });

  it('extractFirstJsonObject returns first JSON object in text', () => {
    const input = 'noise before { "a": { "b": 2 } } trailing text';
    const json = extractFirstJsonObject(input);
    expect(json).toBe('{ "a": { "b": 2 } }');
  });
});
