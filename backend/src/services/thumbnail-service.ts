/**
 * Thumbnail Service
 * Generates AI poster/thumbnail images for works using Cloudflare Workers AI
 * Stores images in R2 and updates works table
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface ThumbnailGenerationResult {
  workId: number;
  title: string;
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export class ThumbnailService {
  constructor(
    private db: D1Database,
    private ai: any // Workers AI binding
  ) {}

  /**
   * Generate a poster-style thumbnail for a work using AI
   */
  async generateThumbnailForWork(workId: number): Promise<ThumbnailGenerationResult> {
    const { results } = await this.db
      .prepare('SELECT canonical_title, synopsis, type, creator_name FROM works WHERE id = ?')
      .bind(workId)
      .all<{ canonical_title: string; synopsis: string | null; type: string; creator_name: string | null }>();

    const work = results?.[0];
    if (!work) {
      return { workId, title: '', success: false, error: 'Work not found' };
    }

    try {
      // Create a prompt for AI image generation
      const prompt = this.createPrompt(work.canonical_title, work.synopsis, work.type, work.creator_name);

      // Generate image using Stable Diffusion XL via Workers AI
      const response = await this.ai.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
        prompt,
        num_steps: 20,
        guidance: 7.5,
        width: 512,
        height: 768, // Portrait poster ratio
      });

      // The response is binary image data
      // For now, we'll convert to base64 data URL since we don't have R2 set up yet
      // In production, this should upload to R2 and return a public URL
      const base64 = this.arrayBufferToBase64(response);
      const dataUrl = `data:image/png;base64,${base64}`;

      // Update work with thumbnail
      await this.db
        .prepare('UPDATE works SET poster_url = ? WHERE id = ?')
        .bind(dataUrl, workId)
        .run();

      return {
        workId,
        title: work.canonical_title,
        success: true,
        imageUrl: dataUrl,
      };
    } catch (error) {
      return {
        workId,
        title: work.canonical_title,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate thumbnails for all works that don't have one
   */
  async generateAllMissingThumbnails(batchSize = 5): Promise<{
    total: number;
    generated: number;
    failed: number;
    results: ThumbnailGenerationResult[];
  }> {
    const { results: works } = await this.db
      .prepare('SELECT id FROM works WHERE poster_url IS NULL OR poster_url = \'\' ORDER BY id')
      .all<{ id: number }>();

    const workIds = (works || []).map(w => w.id);
    const results: ThumbnailGenerationResult[] = [];
    let generated = 0;
    let failed = 0;

    // Process in batches to avoid rate limits
    for (let i = 0; i < workIds.length; i += batchSize) {
      const batch = workIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id => this.generateThumbnailForWork(id))
      );

      for (const result of batchResults) {
        results.push(result);
        if (result.success) generated++;
        else failed++;
      }

      // Small delay between batches
      if (i + batchSize < workIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      total: workIds.length,
      generated,
      failed,
      results,
    };
  }

  /**
   * Set a custom poster URL for a work (e.g. from external source)
   */
  async setCustomPoster(workId: number, imageUrl: string): Promise<boolean> {
    try {
      await this.db
        .prepare('UPDATE works SET poster_url = ? WHERE id = ?')
        .bind(imageUrl, workId)
        .run();
      return true;
    } catch {
      return false;
    }
  }

  private createPrompt(title: string, synopsis: string | null, type: string, creator: string | null): string {
    const typeDesc = type === 'SHORT_FILM' ? 'short film' :
                     type === 'FEATURE_FILM' ? 'feature film' :
                     type === 'DOCUMENTARY' ? 'documentary' :
                     type === 'EXPERIMENTAL' ? 'experimental film' :
                     type === 'SERIES' ? 'series' : 'film';

    const basePrompt = `Cinematic movie poster for "${title}", ${typeDesc}`;
    const detailPrompt = synopsis
      ? `. Visual theme: ${synopsis.substring(0, 200)}`
      : '';

    return `${basePrompt}${detailPrompt}. Professional film poster style, dramatic lighting, high quality, no text, no words, no letters, artistic composition`;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
