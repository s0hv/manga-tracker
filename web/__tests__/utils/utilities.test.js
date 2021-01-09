import { statusToString } from '../../src/utils/utilities';

describe('statusToString', () => {
  it('Returns Ongoing for 0', () => {
    expect(statusToString(0)).toStrictEqual('Ongoing');
  });

  it('Returns Completed for 1', () => {
    expect(statusToString(1)).toStrictEqual('Completed');
  });

  it('Returns Dropped for 2', () => {
    expect(statusToString(2)).toStrictEqual('Dropped');
  });

  it('Returns Hiatus for 3', () => {
    expect(statusToString(3)).toStrictEqual('Hiatus');
  });

  it('Returns Ongoing for other values', () => {
    expect(statusToString()).toStrictEqual('Ongoing');
    expect(statusToString(10)).toStrictEqual('Ongoing');
    expect(statusToString('a')).toStrictEqual('Ongoing');
  });
});
