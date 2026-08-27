import { BaseDataSourceAdapter, type SearchOptions, type SearchResult } from './data-source-adapter';
import type { CandidateVideo } from '../types';

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: { high?: { url: string }; medium?: { url: string } };
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: { high?: { url: string }; medium?: { url: string } };
    channelId: string;
    channelTitle: string;
    publishedAt: string;
  };
  contentDetails: { duration: string };
}

export class YouTubeAdapter extends BaseDataSourceAdapter {
  readonly name = 'youtube';

  constructor(private apiKey: string) {
    super();
  }

  async searchCandidates(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const maxResults = options.maxResults || 50;
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(maxResults),
      key: this.apiKey,
      videoDuration: 'short', // 4 min or less for short films
    });

    if (options.publishedAfter) {
      params.set('publishedAfter', options.publishedAfter.toISOString());
    }
    if (options.publishedBefore) {
      params.set('publishedBefore', options.publishedBefore.toISOString());
    }
    if (options.pageToken) {
      params.set('pageToken', options.pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) {
      throw new Error(`YouTube search failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json() as { items: YouTubeSearchItem[]; nextPageToken?: string; pageInfo?: { totalResults: number } };
    const videoIds = data.items.map(item => item.id.videoId);

    if (videoIds.length === 0) {
      return { videos: [], nextPageToken: data.nextPageToken, totalResults: data.pageInfo?.totalResults };
    }

    const details = await this.getVideoDetailsBatch(videoIds);
    const videos: CandidateVideo[] = [];

    for (const item of data.items) {
      const detail = details[item.id.videoId];
      if (!detail) continue;

      const title = item.snippet.title;
      const description = item.snippet.description;

      if (this.isBlockedContent(title, description)) continue;

      // Phase 11: Only include videos that appear AI-relevant
      // This is a pre-filter before Discovery Score to reduce noise
      if (!this.isAIRelevantContent(title, description)) continue;

      videos.push({
        source_video_id: item.id.videoId,
        title,
        description,
        thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
        channel_id: item.snippet.channelId,
        channel_name: item.snippet.channelTitle,
        published_at: item.snippet.publishedAt,
        duration_seconds: this.extractDurationSeconds(detail.contentDetails.duration),
      });
    }

    return {
      videos,
      nextPageToken: data.nextPageToken,
      totalResults: data.pageInfo?.totalResults,
    };
  }

  async getVideoDetails(videoId: string): Promise<CandidateVideo | null> {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: videoId,
      key: this.apiKey,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!response.ok) return null;

    const data = await response.json() as { items: YouTubeVideoItem[] };
    if (data.items.length === 0) return null;

    const item = data.items[0];
    return {
      source_video_id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
      channel_id: item.snippet.channelId,
      channel_name: item.snippet.channelTitle,
      published_at: item.snippet.publishedAt,
      duration_seconds: this.extractDurationSeconds(item.contentDetails.duration),
    };
  }

  async getChannelVideos(channelId: string, options: SearchOptions = {}): Promise<SearchResult> {
    const maxResults = options.maxResults || 50;
    const params = new URLSearchParams({
      part: 'snippet',
      channelId,
      type: 'video',
      maxResults: String(maxResults),
      key: this.apiKey,
      order: 'date',
    });

    if (options.publishedAfter) {
      params.set('publishedAfter', options.publishedAfter.toISOString());
    }
    if (options.pageToken) {
      params.set('pageToken', options.pageToken);
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) {
      throw new Error(`YouTube channel search failed: ${response.status}`);
    }

    const data = await response.json() as { items: YouTubeSearchItem[]; nextPageToken?: string };
    const videoIds = data.items.map(item => item.id.videoId);

    if (videoIds.length === 0) {
      return { videos: [], nextPageToken: data.nextPageToken };
    }

    const details = await this.getVideoDetailsBatch(videoIds);
    const videos: CandidateVideo[] = [];

    for (const item of data.items) {
      const detail = details[item.id.videoId];
      if (!detail) continue;

      const title = item.snippet.title;
      const description = item.snippet.description;

      if (this.isBlockedContent(title, description)) continue;

      videos.push({
        source_video_id: item.id.videoId,
        title,
        description,
        thumbnail_url: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url || '',
        channel_id: item.snippet.channelId,
        channel_name: item.snippet.channelTitle,
        published_at: item.snippet.publishedAt,
        duration_seconds: this.extractDurationSeconds(detail.contentDetails.duration),
      });
    }

    return {
      videos,
      nextPageToken: data.nextPageToken,
    };
  }

  private async getVideoDetailsBatch(videoIds: string[]): Promise<Record<string, YouTubeVideoItem>> {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      id: videoIds.join(','),
      key: this.apiKey,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!response.ok) return {};

    const data = await response.json() as { items: YouTubeVideoItem[] };
    const map: Record<string, YouTubeVideoItem> = {};
    for (const item of data.items) {
      map[item.id] = item;
    }
    return map;
  }
}
