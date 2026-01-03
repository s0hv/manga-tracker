import { describe, expect, it } from 'vitest';

import { getMangaPartial } from '@/db/manga';
import { addMangaView, onSessionExpire } from '@/serverUtils/view-counter';
import type { SafeSession } from '@/types/session';


describe('mangaView increments manga views correctly', { concurrent: true }, () => {
  it('Does nothing when session is not defined', () => {
    expect(addMangaView(null, '')).toBeFalse();
  });

  it.each(['-1', '0', '', 'aawd'])('Returns false when manga id is "%s"', mangaIdStr => {
    const sess: Pick<SafeSession, 'data'> = {};
    expect(addMangaView(sess, mangaIdStr)).toBeFalse();
    expect(sess.data).toBeUndefined();
  });

  it('Increments the given manga id', () => {
    const sess: Pick<SafeSession, 'data'> = {};
    const mangaId = '1';
    addMangaView(sess, mangaId);

    expect(sess.data).toBeObject();
    expect(sess.data!.mangaViews).toHaveProperty(mangaId);
    expect(sess.data!.mangaViews![mangaId]).toBe(1);

    addMangaView(sess, mangaId);
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
    expect(await onSessionExpire({ data: { mangaViews: {}}})).toBeUndefined();
  });

  it('Increments db views by one at most', async () => {
    const mangaId = 1;
    const manga = await getMangaPartial(mangaId);

    const originalViews = manga.views;
    expect(originalViews).toBeGreaterThanOrEqual(0);

    await onSessionExpire({
      data: {
        mangaViews: {
          1: 5,
        },
      },
    });

    const updatedManga = await getMangaPartial(mangaId);
    expect(originalViews).not.toStrictEqual(updatedManga.views);
    expect(originalViews + 1).toStrictEqual(updatedManga.views);
  });
});
