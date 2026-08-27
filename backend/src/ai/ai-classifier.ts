import type { AIClassificationResult } from '../types';

export interface AIClassifier {
  readonly name: string;
  readonly modelVersion: string;
  readonly promptVersion: string;

  classify(title: string, description: string, durationSeconds: number): Promise<AIClassificationResult | null>;
}

export const DEFAULT_CLASSIFICATION_PROMPT = `You are an expert AI film classifier. Analyze the following video metadata and determine if it is an AI-generated or AI-assisted narrative film/short film.

Input:
- Title: {title}
- Description: {description}
- Duration: {duration} seconds

Rules:
1. Only classify as AI film if the content appears to be AI-generated/AI-assisted narrative storytelling (fiction, drama, sci-fi, animation, etc.)
2. Reject: tutorials, reviews, news, tool demos, educational content, pure music videos, non-story experiments
3. The video should have a coherent story or narrative arc

Output ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "is_ai_film": boolean,
  "is_story_content": boolean,
  "content_type": "short_film" | "feature" | "animation" | "series_episode" | "experimental" | "other",
  "genre": ["sci_fi" | "drama" | "comedy" | "horror" | "animation" | "thriller" | "romance" | "documentary" | "fantasy" | "other"],
  "language": "en" | "zh" | "ja" | "ko" | "fr" | "de" | "es" | "other",
  "ai_generation_level": number (0-1, how much AI was used),
  "story_completeness": number (0-1, how complete the narrative is),
  "confidence": number (0-1, confidence in this classification),
  "summary": "string (max 200 chars describing the film)"
}`;

export function formatPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '');
}

export function parseAIResponse(raw: string): AIClassificationResult | null {
  try {
    const cleaned = raw.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (typeof parsed.is_ai_film !== 'boolean') return null;
    if (typeof parsed.is_story_content !== 'boolean') return null;

    return {
      is_ai_film: parsed.is_ai_film,
      is_story_content: parsed.is_story_content,
      content_type: String(parsed.content_type || 'other'),
      genre: Array.isArray(parsed.genre) ? parsed.genre.map(String) : [],
      language: String(parsed.language || 'other'),
      ai_generation_level: Number(parsed.ai_generation_level || 0),
      story_completeness: Number(parsed.story_completeness || 0),
      confidence: Number(parsed.confidence || 0),
      summary: String(parsed.summary || ''),
    };
  } catch {
    return null;
  }
}

export function repairJson(raw: string): string | null {
  let cleaned = raw.trim();

  // Remove markdown code blocks
  cleaned = cleaned.replace(/```json\s*/g, '');
  cleaned = cleaned.replace(/```\s*/g, '');

  // Extract JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let json = cleaned.slice(start, end + 1);

  // Fix common issues
  json = json.replace(/,\s*([}\]])/g, '$1'); // trailing commas
  json = json.replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":'); // unquoted keys

  return json;
}
