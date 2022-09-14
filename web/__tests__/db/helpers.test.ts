import { db } from '@/db/helpers';
import { NoResultsError, TooManyResultsError } from '@/db/errors';

afterAll(async () => {
  await db.sql.end({ timeout: 5 });
});

describe('one`query`', () => {
  it('throws error when more than one row returned', async () => {
    await expect(db.one`SELECT id FROM (VALUES (1), (2), (3)) as temp(id)`)
      .rejects
      .toThrow(TooManyResultsError);
  });

  it('throws error when no rows returned', async () => {
    await expect(db.one`SELECT id FROM (VALUES (1)) as temp(id) WHERE id=-1`)
      .rejects
      .toThrow(NoResultsError);
  });

  it('returns when a single row is found', async () => {
    await expect(db.one`SELECT id FROM (VALUES (1)) as temp(id)`)
      .resolves
      .toEqual({ id: 1 });
  });
});

describe('oneOrNone`query`', () => {
  it('throws error when more than one row returned', async () => {
    await expect(db.oneOrNone`SELECT id FROM (VALUES (1), (2), (3)) as temp(id)`)
      .rejects
      .toThrow(TooManyResultsError);
  });

  it('resolves with null when no rows found', async () => {
    await expect(db.oneOrNone`SELECT id FROM (VALUES (1)) as temp(id) WHERE id=-1`)
      .resolves
      .toBeNull();
  });

  it('returns when a single row is found', async () => {
    await expect(db.oneOrNone`SELECT id FROM (VALUES (1)) as temp(id)`)
      .resolves
      .toEqual({ id: 1 });
  });
});

describe('many`query`', () => {
  it('throws error when no rows returned', async () => {
    await expect(db.many`SELECT id FROM (VALUES (1)) as temp(id) WHERE id=-1`)
      .rejects
      .toThrow(NoResultsError);
  });

  it('resolves with one row', async () => {
    await expect(db.many`SELECT id FROM (VALUES (1)) as temp(id)`)
      .resolves
      .toEqual([{ id: 1 }]);
  });

  it('resolves with two rows', async () => {
    await expect(db.many`SELECT id FROM (VALUES (1), (2)) as temp(id)`)
      .resolves
      .toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe('manyOrNone`query`', () => {
  it('resolves with empty list when no rows returned', async () => {
    await expect(db.manyOrNone`SELECT id FROM (VALUES (1)) as temp(id) WHERE id=-1`)
      .resolves
      .toEqual([]);
  });

  it('resolves with one row', async () => {
    await expect(db.manyOrNone`SELECT id FROM (VALUES (1)) as temp(id)`)
      .resolves
      .toEqual([{ id: 1 }]);
  });

  it('is the same as any', () => {
    expect(db.manyOrNone).toStrictEqual(db.any);
  });
});

describe('none`query`', () => {
  it('throws when rows returned', async () => {
    await expect(db.none`SELECT id FROM (VALUES (1)) as temp(id)`)
      .rejects
      .toThrow(TooManyResultsError);
  });

  it('resolves with nothing', async () => {
    await expect(db.none`SELECT id FROM (VALUES (1)) as temp(id) WHERE id=-1`)
      .resolves
      .toBeUndefined();
  });
});
