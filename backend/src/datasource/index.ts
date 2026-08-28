export {
  SourceRole,
  SourceAdapterType,
  BaseDataSourceAdapter,
  DataSourceAdapterRegistry,
  createAdapterRegistry,
} from './datasource-adapter-v2';

export type {
  DataSourceAdapterV2,
  DiscoveryInput,
  DiscoveryResult,
  DiscoveredCandidate,
  WorkMetadata,
  PopularityMetrics,
  RecognitionSignal,
} from './datasource-adapter-v2';

export {
  FestivalAdapter,
} from './festival-adapter';

export type {
  FestivalConfig,
  FestivalEntry,
} from './festival-adapter';

export {
  ManualSeedAdapter,
} from './manual-seed-adapter';

export type {
  ManualSeedEntry,
} from './manual-seed-adapter';
