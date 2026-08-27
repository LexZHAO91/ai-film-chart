import { AIClassifier, DEFAULT_CLASSIFICATION_PROMPT, formatPrompt, parseAIResponse, repairJson } from './ai-classifier';
import type { AIClassificationResult } from '../types';

interface CloudflareAIBindingResponse {
  response: string;
}

interface CloudflareAPIResponse {
  result: CloudflareAIBindingResponse;
}

/**
 * CloudflareWorkersAIClassifier
 *
 * Phase 5 要求：
 * 1. 优先使用 Cloudflare Workers AI binding（env.AI），而非运行时保存高权限 API Token
 * 2. 所有模型输出必须是严格 JSON
 * 3. 不允许输出 reasoning
 * 4. 控制 input 长度
 * 5. 控制 output 长度
 * 6. 保存 model_name
 * 7. 保存 model_version
 * 8. 保存 prompt_version
 * 9. AI 失败时可 retry
 * 10. JSON 非法时只允许一次 repair
 */
export class CloudflareWorkersAIClassifier implements AIClassifier {
  readonly name = 'cloudflare-workers-ai';
  readonly modelVersion = '@cf/meta/llama-3.1-8b-instruct';
  readonly promptVersion = 'v2.0';

  // Retry configuration
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;

  // Input/Output limits
  private readonly MAX_TITLE_LENGTH = 200;
  private readonly MAX_DESCRIPTION_LENGTH = 800;
  private readonly MAX_OUTPUT_TOKENS = 512;

  constructor(
    private aiBinding?: Ai,
    private accountId?: string,
    private apiToken?: string
  ) {}

  async classify(title: string, description: string, durationSeconds: number): Promise<AIClassificationResult | null> {
    const truncatedTitle = title.slice(0, this.MAX_TITLE_LENGTH);
    const truncatedDescription = description.slice(0, this.MAX_DESCRIPTION_LENGTH);

    const prompt = formatPrompt(DEFAULT_CLASSIFICATION_PROMPT, {
      title: truncatedTitle,
      description: truncatedDescription,
      duration: String(durationSeconds),
    });

    // Try with retry
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const raw = await this.callAI(prompt);

        // Try parsing directly first
        let result = parseAIResponse(raw);

        // If failed, try JSON repair (only once)
        if (!result) {
          const repaired = repairJson(raw);
          if (repaired) {
            result = parseAIResponse(repaired);
          }
        }

        if (result) {
          return {
            ...result,
            // Ensure metadata is attached
            model_name: this.name,
            model_version: this.modelVersion,
            prompt_version: this.promptVersion,
          };
        }

        // Parsed but got null - retry
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY_MS * (attempt + 1));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }

    // All retries exhausted
    if (lastError) {
      console.error(`AI classification failed after ${this.MAX_RETRIES + 1} attempts:`, lastError.message);
    }

    return null;
  }

  private async callAI(prompt: string): Promise<string> {
    // Priority 1: Use Cloudflare Workers AI binding (preferred)
    if (this.aiBinding) {
      const response = await this.aiBinding.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are a precise AI film classifier. Output only valid JSON. No explanation, no reasoning, no markdown.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: this.MAX_OUTPUT_TOKENS,
      }) as { response: string };

      return response.response;
    }

    // Priority 2: Fallback to API token (not preferred, but supported)
    if (!this.accountId || !this.apiToken) {
      throw new Error('No AI binding or API credentials available');
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a precise AI film classifier. Output only valid JSON. No explanation, no reasoning, no markdown.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: this.MAX_OUTPUT_TOKENS,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as CloudflareAPIResponse;
    return data.result.response;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
