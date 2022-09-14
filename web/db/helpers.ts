import type { AsRowList, Row, RowList } from 'postgres';
import { type Db, sql } from '@/db/index';
import { NoResultsError, TooManyResultsError } from '@/db/errors';


export type RowType = readonly (object | undefined)[];
type TemplateArgs<T extends RowType = Row[]> = Parameters<typeof sql<T>>;
type ResultType<T extends RowType = Row[]> = Promise<RowList<AsRowList<T>>>;

export const createHelpers = (sql_: Db) => {
  const customSql = <T extends Row>(...args: TemplateArgs<T[]>): ResultType<T[]> => {
    const [template, ...rest] = args;
    return sql_<T[]>(template, ...rest);
  };


  const oneOrNone = async <T extends Row>(...args: TemplateArgs<T[]>): Promise<T | null> => {
    const result = await customSql<T>(...args);
    if (result.length > 1) {
      throw new TooManyResultsError('Over one row found', result);
    }

    return result[0] as any as T || null;
  };


  const one = async <T extends Row>(...args: TemplateArgs<T[]>): Promise<T> => {
    const result = await customSql<T>(...args);

    if (result.length < 1) {
      throw new NoResultsError('No rows found', result);
    } else if (result.length > 1) {
      throw new TooManyResultsError('Over one row found', result);
    }

    return result[0] as any as T;
  };

  const many = async <T extends Row>(...args: TemplateArgs<T[]>): ResultType<T[]> => {
    const result = await customSql<T>(...args);

    if (result.length < 1) {
      throw new NoResultsError('No rows found', result);
    }

    return result;
  };

  const manyOrNone = <T extends Row>(...args: TemplateArgs<T[]>): ResultType<T[]> => {
    return customSql<T>(...args);
  };

  const any = manyOrNone;

  const none = async (...args: TemplateArgs): Promise<void> => {
    const result = await customSql(...args);

    if (result.length > 0) {
      throw new TooManyResultsError(`Expected no returned rows but got ${result.length} rows`, result);
    }
  };

  return {
    one,
    oneOrNone,
    many,
    any,
    manyOrNone,
    none,
    sql: sql_,
  } as const;
};


export const db = createHelpers(sql);

export type DatabaseHelpers = typeof db;
