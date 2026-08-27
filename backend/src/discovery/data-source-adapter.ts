import type { CandidateVideo } from '../types';

export interface DataSourceAdapter {
  readonly name: string;

  searchCandidates(query: string, options?: SearchOptions): Promise<SearchResult>;

  getVideoDetails(videoId: string): Promise<CandidateVideo | null>;

  getChannelVideos(channelId: string, options?: SearchOptions): Promise<SearchResult>;
}

export interface SearchOptions {
  maxResults?: number;
  publishedAfter?: Date;
  publishedBefore?: Date;
  pageToken?: string;
}

export interface SearchResult {
  videos: CandidateVideo[];
  nextPageToken?: string;
  totalResults?: number;
}

export abstract class BaseDataSourceAdapter implements DataSourceAdapter {
  abstract readonly name: string;

  abstract searchCandidates(query: string, options?: SearchOptions): Promise<SearchResult>;

  abstract getVideoDetails(videoId: string): Promise<CandidateVideo | null>;

  abstract getChannelVideos(channelId: string, options?: SearchOptions): Promise<SearchResult>;

  protected isBlockedContent(title: string, description: string): boolean {
    const blockedPatterns = [
      /\btutorial\b/i,
      /\bhow\s+to\b/i,
      /\breview\b/i,
      /\bnews\b/i,
      /\bprompt\b/i,
      /\bbehind\s+the\s+scenes\b/i,
      /\btool\s+demo\b/i,
      /\bproduct\s+demo\b/i,
      /\bai\s+tool\s+introduction\b/i,
      /\beducational\b/i,
      /\bpure\s+music\b/i,
      /\bnon-story\b/i,
      /\bexperiment\b/i,
      /\btest\b/i,
    ];

    const text = `${title} ${description}`.toLowerCase();
    return blockedPatterns.some(pattern => pattern.test(text));
  }

  protected isAIRelevantContent(title: string, description: string): boolean {
    const aiPatterns = [
      /\bai[-\s]generated\b/i,
      /\bai[-\s]film\b/i,
      /\bai[-\s]movie\b/i,
      /\bai[-\s]cinema\b/i,
      /\bai[-\s]short\b/i,
      /\bai[-\s]animation\b/i,
      /\bgenerated\s+by\s+ai\b/i,
      /\bcreated\s+with\s+ai\b/i,
      /\bstable\s+diffusion\b/i,
      /\bmidjourney\b/i,
      /\brunway\b/i,
      /\bpika\b/i,
      /\bsora\b/i,
      /\bkling\b/i,
      /\bluma\b/i,
      /\bhaiper\b/i,
      /\bgen[-\s]2\b/i,
      /\bgen[-\s]3\b/i,
    ];

    const text = `${title} ${description}`.toLowerCase();
    return aiPatterns.some(pattern => pattern.test(text));
  }

  protected extractDurationSeconds(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
}
