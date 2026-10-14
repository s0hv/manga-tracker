import * as z from 'zod';

export const SearchQuerySchema = z.string('No search query specified')
  .min(2, { error: 'Query must be between 2 and 500 characters' })
  .max(500, { error: 'Query must be between 2 and 500 characters' });
