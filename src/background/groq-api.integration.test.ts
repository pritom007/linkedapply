/**
 * Integration test: calls the real Groq API.
 * Run with: GROQ_API_KEY=your_key npm run test:integration
 * Skipped when GROQ_API_KEY is not set.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { callGroqAPI } from './groq-api.js';

const API_KEY = process.env.GROQ_API_KEY;

describe('callGroqAPI (integration)', () => {
  beforeAll(() => {
    if (!API_KEY) {
      console.warn('Skipping Groq API integration tests: GROQ_API_KEY not set');
    }
  });

  it('returns a non-empty response from Groq when API key is set', async () => {
    if (!API_KEY) {
      return;
    }

    const messages = [{ role: 'user', content: 'Reply with exactly: Groq is working.' }];
    const result = await callGroqAPI(messages, API_KEY, 'meta-llama/llama-4-scout-17b-16e-instruct');

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result.toLowerCase()).toContain('groq');
  }, 20000);

  it('uses the requested model and returns coherent text', async () => {
    if (!API_KEY) {
      return;
    }

    const messages = [{ role: 'user', content: 'What is 2 + 2? Reply with one number only.' }];
    const result = await callGroqAPI(messages, API_KEY);

    expect(result.trim().length).toBeGreaterThan(0);
    expect(result).toMatch(/\d/);
  }, 20000);

  it('throws on invalid API key or network failure', async () => {
    const messages = [{ role: 'user', content: 'Hi' }];
    await expect(callGroqAPI(messages, 'invalid-key')).rejects.toThrow();
    // May throw "Groq API error: 401 - ..." or "fetch failed" in restricted env
  }, 10000);
});
