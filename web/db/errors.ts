import type { AsRowList, Row, RowList } from 'postgres';

export class NoColumnsError extends Error {}

export class QueryResultError<T extends readonly any[] = Row[]> extends Error {
  result: RowList<AsRowList<T>>;

  constructor(msg: string, result: RowList<AsRowList<T>>) {
    super(msg);

    this.result = result;
  }
}
export class TooManyResultsError extends QueryResultError {}
export class NoResultsError extends QueryResultError {}
