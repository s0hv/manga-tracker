import type { TableFeatures } from '@tanstack/react-table';

export type WithRequiredFeature<
  TFeatureName extends keyof TableFeatures,
  TFeatures extends TableFeatures = TableFeatures
> =
  Required<Pick<TFeatures, TFeatureName>> & Omit<TFeatures, TFeatureName>;
