import { statusToString } from '../../src/utils/utilities';
import { groupBy } from '../../common/utilities';

describe('statusToString', () => {
  it('Returns Ongoing for 0', () => {
    expect(statusToString(0)).toBe('Ongoing');
  });

  it('Returns Completed for 1', () => {
    expect(statusToString(1)).toBe('Completed');
  });

  it('Returns Dropped for 2', () => {
    expect(statusToString(2)).toBe('Dropped');
  });

  it('Returns Hiatus for 3', () => {
    expect(statusToString(3)).toBe('Hiatus');
  });

  it('Returns Ongoing for other values', () => {
    expect(statusToString()).toBe('Ongoing');
    expect(statusToString(10)).toBe('Ongoing');
    expect(statusToString('a')).toBe('Ongoing');
  });
});

describe('groupBy', () => {
  const errorMessage = /Input must be an array/i;

  const groupKeyProperty = 'group';
  const generateData = (group, count = 1) => new Array(count).fill(0)
    .map(() => ({
      [groupKeyProperty]: group,
      value: 123,
    }));

  const groupA = 'a';
  const groupB = 'b';
  const groupC = 'c';

  it('Should return empty list on empty input', () => {
    expect(groupBy([], 'test')).toEqual([]);
  });

  it('Should throw when input is not list', () => {
    expect(() => groupBy(undefined, 'test')).toThrowWithMessage(TypeError, errorMessage);
    expect(() => groupBy({}, 'test')).toThrowWithMessage(TypeError, errorMessage);
    expect(() => groupBy('abc', 'test')).toThrowWithMessage(TypeError, errorMessage);
    expect(() => groupBy(new Set(), 'test')).toThrowWithMessage(TypeError, errorMessage);
  });

  it('Should group by given string key while keeping order', () => {
    const groupCounts = [
      [groupA, 3],
      [groupB, 1],
      [groupA, 2],
      [groupC, 1],
      [groupB, 2],
    ];
    const groupedData = groupCounts
      .reduce((prev, g) => [...prev, ...generateData(g[0], g[1])], []);

    const grouped = groupBy(groupedData, groupKeyProperty);
    expect(grouped).toHaveLength(5);

    let start = 0;
    let idx = 0;
    grouped.forEach((group) => {
      const [groupKey, count] = groupCounts[idx];
      expect([...group.arr]).toEqual(groupedData.slice(start, start + count));
      expect(group).toHaveProperty('group', groupKey);

      start += count;
      idx++;
    });
  });

  it('Should group by given string key only partially keeping order', () => {
    const groupCounts = [
      [groupA, 3],
      [groupB, 1],
      [groupA, 2],
      [groupC, 1],
      [groupB, 2],
    ];

    const groupedData = groupCounts.map(([group, count]) => generateData(group, count));

    const groupedDataFlat = groupedData
      .reduce((prev, curr) => [...prev, ...curr], []);

    const grouped = groupBy(groupedDataFlat, groupKeyProperty, { keepOrder: false });
    expect(grouped).toHaveLength(3);

    // A group
    expect([...grouped[0]]).toEqual(
      [...groupedData[0], ...groupedData[2]]
    );
    expect(grouped[0]).not.toHaveProperty('group', groupA);
    expect(grouped[0]).toHaveLength(5);

    // B group
    expect([...grouped[1]]).toEqual(
      [...groupedData[1], ...groupedData[4]]
    );
    expect(grouped[1]).not.toHaveProperty('group', groupB);
    expect(grouped[1]).toHaveLength(3);

    // C group
    expect([...grouped[2]]).toEqual(groupedData[3]);
    expect(grouped[2]).not.toHaveProperty('group', groupC);
    expect(grouped[2]).toHaveLength(1);
  });

  it('Should not group similar objects with order', () => {
    const groupedData = [
      ...generateData({ test: groupA }, 2),
      ...generateData({ test: groupA }, 1),
    ];

    const grouped = groupBy(groupedData, groupKeyProperty);
    expect(grouped).toHaveLength(2);
  });

  it('Should not group similar objects without order', () => {
    const groupedData = [
      ...generateData({ test: groupA }, 2),
      ...generateData({ test: groupC }, 2),
      ...generateData({ test: groupA }, 1),
    ];

    const grouped = groupBy(groupedData, groupKeyProperty, { keepOrder: false });
    expect(grouped).toHaveLength(3);
  });

  it('Should work with function as group key with order', () => {
    const groupedData = [
      ...generateData({ test: groupA }, 2),
      ...generateData({ test: groupC }, 2),
      ...generateData({ test: groupA }, 1),
    ];

    const grouped = groupBy(groupedData, (group) => group[groupKeyProperty].test);
    expect(grouped).toHaveLength(3);
  });

  it('Should work with function as group key without order', () => {
    const groupedData = [
      ...generateData({ test: groupA }, 2),
      ...generateData({ test: groupC }, 2),
      ...generateData({ test: groupA }, 1),
      ...generateData({ test: groupC }, 2),
    ];

    const grouped = groupBy(groupedData, (group) => group[groupKeyProperty].test, { keepOrder: false });
    expect(grouped).toHaveLength(2);
  });
});
