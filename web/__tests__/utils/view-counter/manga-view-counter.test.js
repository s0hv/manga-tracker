import { getMangaPartial } from '../../../db/manga';
import { mangaView, onSessionExpire } from '../../../utils/view-counter';


afterAll(async () => {
  const { end } = require('../../../db');
  await end();
});

describe('mangaView increments manga views correctly', () => {
  it('Does nothing when session is not defined', () => {
    expect(mangaView(null)).toBeUndefined();
  });

  it('Adds manga views object when it is missing', () => {
    const sess = {};
    mangaView(sess, {});
    expect(sess).toHaveProperty('mangaViews');
    expect(sess.mangaViews).toBeObject();
  });

  it('Returns when manga id not present in params', () => {
    const sess = {};
    mangaView(sess, {});
    expect(sess.mangaViews).toBeEmpty();
  });

  it('Increments the given manga id', () => {
    const sess = {};
    const mangaId = '1';
    mangaView(sess, { mangaId: mangaId });

    expect(sess.mangaViews).toHaveProperty(mangaId);
    expect(sess.mangaViews[mangaId]).toBe(1);

    mangaView(sess, { mangaId: mangaId });
    expect(sess.mangaViews[mangaId]).toBe(2);
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
    expect(originalViews+1).toStrictEqual(updatedManga.views);
  });
});
