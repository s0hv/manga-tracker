import type { AdapterSession } from 'next-auth/adapters';
import { describe, expect, it } from 'vitest';

import { getMangaPartial } from '@/db/manga';
import { addMangaView, onSessionExpire } from '@/serverUtils/view-counter';


describe('mangaView increments manga views correctly', () => {
  it('Does nothing when session is not defined', () => {
    expect(addMangaView(null, {})).toBeUndefined();
  });

  it('Returns when manga id not present in params', () => {
    const sess: Partial<AdapterSession> = {};
    addMangaView(sess, {});
    expect(sess.data).toBeUndefined();
  });

  it('Increments the given manga id', () => {
    const sess: Partial<AdapterSession> = {};
    const mangaId = '1';
    addMangaView(sess, { mangaId: mangaId });

    expect(sess.data).toBeObject();
    expect(sess.data!.mangaViews).toHaveProperty(mangaId);
    expect(sess.data!.mangaViews![mangaId]).toBe(1);

    addMangaView(sess, { mangaId: mangaId });
    expect(sess.data!.mangaViews![mangaId]).toBe(2);
  });
});

describe('onSessionExpire should work correctly', () => {
  it('Does nothing when session is not defined', async () => {
    expect(await onSessionExpire(null)).toBeUndefined();
  });

  it('Does nothing when mangaViews is not defined', async () => {
    expect(await onSessionExpire({})).toBeUndefined();
  });

  it('Does not crash when mangaViews is empty', async () => {
    expect(await onSessionExpire({ mangaViews: {}})).toBeUndefined();
  });

  it('Increments db views by one at most', async () => {
    const mangaId = 1;
    const manga = await getMangaPartial(mangaId);

    const originalViews = manga.views;
    expect(originalViews).toBeGreaterThanOrEqual(0);

    await onSessionExpire({
      mangaViews: {
        1: 5,
      },
    });

    const updatedManga = await getMangaPartial(mangaId);
    expect(originalViews).not.toStrictEqual(updatedManga.views);
    expect(originalViews + 1).toStrictEqual(updatedManga.views);
  });
});
