import { statusToString } from '../../src/utils/utilities';

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
