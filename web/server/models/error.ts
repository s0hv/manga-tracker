export interface ApiErrorBody<T> {
  error: T
}

export type ZodError = Record<string, string[]>;

export type ZodApiError = ApiErrorBody<ZodError>;
