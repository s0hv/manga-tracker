import { getLatestReleases, getUserFollows } from '../../db/db';
import { normalUser } from '../utils';


afterAll(async () => {
  const { end } = require('../../db');
  await end();
});

describe('getLatestReleases()', () => {
  const serviceId = 1;
  const mangaId = 1;

  const expectValidOutput = (res) => {
    expect(res).toBeDefined();
    expect(res).toBeArray();
  };

  it('Works without crashing with all arguments', async () => {
    expectValidOutput(await getLatestReleases(serviceId, mangaId, normalUser.userUuid));
  });

  it('Works without crashing with only user uuid', async () => {
    expectValidOutput(await getLatestReleases(undefined, undefined, normalUser.userUuid));
  });

  it('Works without crashing with only user service id', async () => {
    expectValidOutput(await getLatestReleases(serviceId, mangaId));
  });

  it('Works without crashing with only user manga id', async () => {
    expectValidOutput(await getLatestReleases(undefined, mangaId, undefined));
  });

  it('Works without crashing without arguments', async () => {
    expectValidOutput(await getLatestReleases());
  });
});

describe('getUserFollows()', () => {
  const mangaId = 1;
  it('Returns service ids of manga follow', async () => {
    const rows = await getUserFollows(normalUser.userId, mangaId);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach(r => {
      expect(r).toHaveProperty('serviceId');
    });
  });

  it('Returns empty list with not found manga id', async () => {
    const rows = await getUserFollows(normalUser.userId, 9999999);
    expect(rows).toHaveLength(0);
  });
});
