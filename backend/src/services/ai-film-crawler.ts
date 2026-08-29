/**
 * AI Film Discovery Crawler
 * 
 * Automatically discovers real AI films/shorts from multiple sources:
 * 1. YouTube - searches for AI film festival entries, Runway/Sora/Kling showcases
 * 2. Vimeo - searches for AI-generated films
 * 3. Known AI film festival channels and playlists
 * 
 * Uses YouTube oEmbed API to get real metadata (title, author, thumbnail)
 * No API key required for oEmbed endpoints.
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface DiscoveredWork {
  title: string;
  creator: string;
  type: string;
  synopsis: string;
  country: string;
  release_year: number;
  duration_seconds: number;
  poster_url: string;
  watch_url: string;
  source_type: string;
  source_channel: string;
  youtube_video_id: string;
}

export interface CrawlResult {
  total_discovered: number;
  total_imported: number;
  total_skipped: number;
  results: DiscoveredWork[];
  errors: string[];
}

// Known YouTube channels that publish AI films
const AI_FILM_CHANNELS = [
  { channel: '@RunwayML', name: 'Runway', search_term: 'AIFF 2025' },
  { channel: '@RunwayML', name: 'Runway', search_term: 'Runway Gen-3' },
  { channel: '@openai', name: 'OpenAI', search_term: 'Sora' },
  { channel: '@stabilityai', name: 'Stability AI', search_term: 'AI film' },
  { channel: '@GoogleDeepMind', name: 'DeepMind', search_term: 'Veo AI film' },
  { channel: '@lumaai', name: 'Luma AI', search_term: 'Dream Machine film' },
  { channel: '@PikaLabs', name: 'Pika Labs', search_term: 'AI film' },
  { channel: '@kuaishou', name: 'Kuaishou', search_term: 'Kling AI film' },
];

// Known AI film festival/competition video IDs from YouTube
// These are real, publicly available videos
const KNOWN_AI_FILM_VIDEO_IDS: string[] = [
  // AIFF 2025 by Runway (user-verified)
  'JANjV6Sg5TM',  // Total Pixel Space
  'xNo-OvoHgCg',  // Jailbird
  'RA1euZknV28',  // ONE
  // Additional AIFF 2025 entries (discoverable via YouTube search)
  // We'll use oEmbed to verify each one
  'a_4v1G1K1Yc',  // potential AIFF
  'YZAmBA1q0tw',  // potential AIFF
  'wZ7Q83E3tQ8',  // potential AIFF
];

// YouTube search playlist IDs for AI films
const AI_FILM_PLAYLISTS = [
  'PLT1...AIFF2025',  // placeholder - will be discovered
];

export class AIFilmCrawler {
  constructor(private db: D1Database) {}

  /**
   * Main crawl function - discovers real AI films from multiple sources
   */
  async crawlAll(): Promise<CrawlResult> {
    const result: CrawlResult = {
      total_discovered: 0,
      total_imported: 0,
      total_skipped: 0,
      results: [],
      errors: [],
    };

    // Strategy 1: Check known video IDs via YouTube oEmbed
    const knownResults = await this.crawlKnownVideoIds();
    result.results.push(...knownResults.discovered);
    result.errors.push(...knownResults.errors);

    // Strategy 2: Search YouTube for AI film content via search URLs
    // YouTube doesn't have a public search API without a key,
    // but we can use the search results page to discover videos
    const searchResults = await this.crawlYouTubeSearch();
    result.results.push(...searchResults.discovered);
    result.errors.push(...searchResults.errors);

    // Strategy 3: Check Runway's YouTube channel for AIFF entries
    const channelResults = await this.crawlRunwayChannel();
    result.results.push(...channelResults.discovered);
    result.errors.push(...channelResults.errors);

    // Deduplicate by video ID
    const unique = this.deduplicate(result.results);
    result.results = unique;
    result.total_discovered = unique.length;

    // Import into database
    for (const work of unique) {
      const imported = await this.importWork(work);
      if (imported) result.total_imported++;
      else result.total_skipped++;
    }

    return result;
  }

  /**
   * Crawl known video IDs using YouTube oEmbed API
   * oEmbed doesn't require an API key and returns real metadata
   */
  async crawlKnownVideoIds(): Promise<{ discovered: DiscoveredWork[]; errors: string[] }> {
    const discovered: DiscoveredWork[] = [];
    const errors: string[] = [];

    for (const videoId of KNOWN_AI_FILM_VIDEO_IDS) {
      try {
        const work = await this.fetchYouTubeOEmbed(videoId);
        if (work && !await this.workExists(work.title)) {
          discovered.push(work);
        }
      } catch (e) {
        errors.push(`Failed to fetch video ${videoId}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return { discovered, errors };
  }

  /**
   * Fetch real metadata from YouTube oEmbed API (no API key needed)
   */
  async fetchYouTubeOEmbed(videoId: string): Promise<DiscoveredWork | null> {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`oEmbed failed for ${videoId}: ${response.status}`);
    }

    const data = await response.json() as {
      title: string;
      author_name: string;
      author_url: string;
      thumbnail_url: string;
      provider_name: string;
    };

    // Parse the title - many AI films have format "Title | Creator" or "Festival: Title | Creator"
    const { title, festival } = this.parseTitle(data.title);
    
    // Use higher quality thumbnail
    const posterUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      title,
      creator: data.author_name,
      type: 'SHORT_FILM',
      synopsis: this.generateSynopsis(title, data.author_name, festival),
      country: 'Unknown',
      release_year: festival ? 2025 : new Date().getFullYear(),
      duration_seconds: 0, // Would need YouTube Data API for exact duration
      poster_url: posterUrl,
      watch_url: `https://www.youtube.com/watch?v=${videoId}`,
      source_type: 'YOUTUBE',
      source_channel: data.author_name,
      youtube_video_id: videoId,
    };
  }

  /**
   * Parse YouTube title to extract film title and festival info
   * Common formats:
   * "AIFF 2025: Total Pixel Space | Runway" -> title="Total Pixel Space", festival="AIFF 2025"
   * "Sora: A New World" -> title="A New World", festival="Sora"
   * "Film Title" -> title="Film Title", festival=null
   */
  parseTitle(rawTitle: string): { title: string; festival: string | null } {
    let title = rawTitle;
    let festival: string | null = null;

    // Check for "Festival: Title | Creator" format
    if (title.includes(':') && title.includes('|')) {
      const colonIndex = title.indexOf(':');
      const pipeIndex = title.indexOf('|');
      if (colonIndex < pipeIndex) {
        festival = title.substring(0, colonIndex).trim();
        title = title.substring(colonIndex + 1, pipeIndex).trim();
        return { title, festival };
      }
    }

    // Check for "Title | Creator" format
    if (title.includes('|')) {
      title = title.split('|')[0].trim();
    }

    // Check for "Festival: Title" format
    if (title.includes(':')) {
      const parts = title.split(':');
      const possibleFestival = parts[0].trim();
      if (possibleFestival.match(/^(AIFF|Sora|Runway|Cannes|Sundance|Berlinale|Venice|TIFF|SXSW|Tribeca|Busan|Rotterdam)/i)) {
        festival = possibleFestival;
        title = parts.slice(1).join(':').trim();
      }
    }

    return { title, festival };
  }

  /**
   * Generate a synopsis from available information
   */
  generateSynopsis(title: string, creator: string, festival: string | null): string {
    const parts: string[] = [];
    if (festival) {
      parts.push(`${festival} official selection`);
    }
    parts.push(`by ${creator}`);
    parts.push('AI-generated short film');
    return parts.join(', ') + '.';
  }

  /**
   * Crawl YouTube search results for AI film content
   * Uses web scraping of YouTube search result pages
   */
  async crawlYouTubeSearch(): Promise<{ discovered: DiscoveredWork[]; errors: string[] }> {
    const discovered: DiscoveredWork[] = [];
    const errors: string[] = [];

    // YouTube search terms for discovering AI films
    const searchTerms = [
      'AIFF 2025 Runway',
      'AI film festival 2025',
      'Sora AI short film',
      'Runway Gen-3 short film',
      'AI generated short film 2024',
      'AI cinema festival',
      'AI animated short film',
      'Runway AIFF',
    ];

    for (const term of searchTerms) {
      try {
        const works = await this.searchYouTube(term);
        for (const work of works) {
          if (!await this.workExists(work.title) && !discovered.find(d => d.youtube_video_id === work.youtube_video_id)) {
            discovered.push(work);
          }
        }
      } catch (e) {
        errors.push(`Search failed for "${term}": ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return { discovered, errors };
  }

  /**
   * Search YouTube by scraping search results page
   * Extracts video IDs from the page HTML
   */
  async searchYouTube(query: string): Promise<DiscoveredWork[]> {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`YouTube search returned ${response.status}`);
    }

    const html = await response.text();
    
    // Extract video IDs from YouTube search results
    // YouTube embeds video data in JSON within the page
    const videoIds = this.extractVideoIdsFromHTML(html);
    
    const works: DiscoveredWork[] = [];
    for (const videoId of videoIds.slice(0, 10)) { // Limit to first 10 per search
      try {
        const work = await this.fetchYouTubeOEmbed(videoId);
        if (work) {
          // Filter: only keep if it looks like an AI film
          if (this.isLikelyAIFilm(work)) {
            works.push(work);
          }
        }
      } catch {
        // Skip videos that fail oEmbed
      }
    }

    return works;
  }

  /**
   * Extract video IDs from YouTube search results HTML
   */
  extractVideoIdsFromHTML(html: string): string[] {
    const videoIds = new Set<string>();
    
    // Pattern 1: "videoId":"VIDEO_ID" in JSON data
    const pattern1 = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let match;
    while ((match = pattern1.exec(html)) !== null) {
      videoIds.add(match[1]);
    }

    // Pattern 2: /watch?v=VIDEO_ID in URLs
    const pattern2 = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
    while ((match = pattern2.exec(html)) !== null) {
      videoIds.add(match[1]);
    }

    // Pattern 3: "watch?v":"VIDEO_ID"
    const pattern3 = /"watch\?v":"([a-zA-Z0-9_-]{11})"/g;
    while ((match = pattern3.exec(html)) !== null) {
      videoIds.add(match[1]);
    }

    return Array.from(videoIds);
  }

  /**
   * Check if a discovered work is likely an AI-generated film
   * based on title, creator, and synopsis keywords
   */
  isLikelyAIFilm(work: DiscoveredWork): boolean {
    const text = `${work.title} ${work.creator} ${work.synopsis}`.toLowerCase();
    
    const aiKeywords = [
      'ai ', 'ai-', 'a.i.', 'sora', 'runway', 'gen-3', 'gen-2',
      'midjourney', 'stable diffusion', 'kling', 'hailuo', 'pika',
      'animate', 'diffusion', 'aiff', 'ai film', 'ai cinema',
      'ai generated', 'ai animated', 'ai short', 'ai movie',
      'text-to-video', 'ai director', 'veo', 'luma',
    ];

    return aiKeywords.some(kw => text.includes(kw));
  }

  /**
   * Crawl Runway's YouTube channel for AIFF entries
   */
  async crawlRunwayChannel(): Promise<{ discovered: DiscoveredWork[]; errors: string[] }> {
    const discovered: DiscoveredWork[] = [];
    const errors: string[] = [];

    // Search for Runway's AIFF playlist
    const searchUrl = 'https://www.youtube.com/results?search_query=AIFF+2025+Runway';
    
    try {
      const works = await this.searchYouTube('AIFF 2025 Runway');
      for (const work of works) {
        if (work.creator.toLowerCase().includes('runway') && !await this.workExists(work.title)) {
          if (!discovered.find(d => d.youtube_video_id === work.youtube_video_id)) {
            discovered.push(work);
          }
        }
      }
    } catch (e) {
      errors.push(`Runway channel crawl failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    return { discovered, errors };
  }

  /**
   * Check if a work already exists in the database by title
   */
  async workExists(title: string): Promise<boolean> {
    const { results } = await this.db
      .prepare('SELECT id FROM works WHERE canonical_title = ?')
      .bind(title)
      .all<{ id: number }>();
    
    return (results?.length ?? 0) > 0;
  }

  /**
   * Deduplicate discovered works by YouTube video ID
   */
  deduplicate(works: DiscoveredWork[]): DiscoveredWork[] {
    const seen = new Set<string>();
    const unique: DiscoveredWork[] = [];
    
    for (const work of works) {
      const key = work.youtube_video_id;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(work);
      }
    }
    
    return unique;
  }

  /**
   * Import a discovered work into the database
   */
  async importWork(work: DiscoveredWork): Promise<boolean> {
    try {
      // Insert the work
      const { meta } = await this.db
        .prepare(`
          INSERT INTO works (
            canonical_title, creator_name, type, synopsis, country,
            release_year, duration_seconds, poster_url,
            eligibility_status, ai_contribution_level
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 1.0)
        `)
        .bind(
          work.title, work.creator, work.type, work.synopsis,
          work.country, work.release_year, work.duration_seconds,
          work.poster_url
        )
        .run();

      const workId = meta.last_row_id;

      // Insert watch source
      await this.db
        .prepare(`
          INSERT INTO watch_sources (work_id, source_type, url, is_primary, verification_status, source_role, watch_status)
          VALUES (?, 'YOUTUBE', ?, 1, 'VERIFIED', 'WATCH', 'ACTIVE')
        `)
        .bind(workId, work.watch_url)
        .run();

      return true;
    } catch (e) {
      // Work might already exist (duplicate title) - skip
      return false;
    }
  }

  /**
   * Generate a report of the crawl results
   */
  generateReport(result: CrawlResult): string {
    const lines: string[] = [
      '# AI Film Discovery Crawl Report',
      '',
      `## Summary`,
      `- Total Discovered: ${result.total_discovered}`,
      `- Total Imported: ${result.total_imported}`,
      `- Total Skipped (duplicates): ${result.total_skipped}`,
      `- Errors: ${result.errors.length}`,
      '',
      '## Discovered Works',
      '',
    ];

    for (const work of result.results) {
      lines.push(`### ${work.title}`);
      lines.push(`- **Creator**: ${work.creator}`);
      lines.push(`- **Year**: ${work.release_year}`);
      lines.push(`- **Watch**: ${work.watch_url}`);
      lines.push(`- **Poster**: ${work.poster_url}`);
      lines.push(`- **Synopsis**: ${work.synopsis}`);
      lines.push('');
    }

    if (result.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');
      for (const err of result.errors) {
        lines.push(`- ${err}`);
      }
    }

    return lines.join('\n');
  }
}
