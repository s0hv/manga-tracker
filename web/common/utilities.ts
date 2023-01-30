import { Group } from '@/webUtils/utilities';

type GetKey<T> = (value: T) => string;
interface GroupByOptions<B extends boolean = boolean, C extends boolean = boolean> {
  keepOrder: B
  returnAsDict?: C
}

type GroupBy = {
  <T, B extends true = true, C extends false = false>(arr: T[], getKeyOrKey: keyof T | GetKey<T>, options?: GroupByOptions<B, C>): Group<T>[]
  <T, B extends false = false, C extends false = false>(arr: T[], getKeyOrKey: keyof T | GetKey<T>, options?: GroupByOptions<B, C>): T[][]
  <T, B extends false = false, C extends true = true>(arr: T[], getKeyOrKey: keyof T | GetKey<T>, options?: GroupByOptions<B, C>): {[key: string]: T[]}
}

/**
 *
 * @param arr
 * @param getKeyOrKey Either an object property name or a function that returns the group key
 * @param options
 * @param options.keepOrder If true the order of the array will be kept the same
 * meaning the same key can be grouped multiple times
 * @param options.returnAsDict If true returns the grouped values as a dictionary. Ignored if keepOrder is true.
 */
export const groupBy: GroupBy = <T, >(
  arr: T[],
  getKeyOrKey: keyof T | GetKey<T>,
  { keepOrder = true, returnAsDict = false } = {} as GroupByOptions<true, false>
  // By adding "| T" to the return type somehow fixes overload errors WTF???
  // GJ typescript
): Group<T>[] | T[][] | T | {[key: string]: T[]} => {
  if (!Array.isArray(arr)) {
    throw new TypeError('Input must be an array');
  }

  if (arr.length === 0) {
    return returnAsDict ? {} : [];
  }

  let getKey: GetKey<T>;
  if (typeof getKeyOrKey === 'string') {
    const _key = getKeyOrKey;
    getKey = (o) => (o as any)[_key];
  } else {
    getKey = getKeyOrKey as any;
  }

  if (keepOrder) {
    const groups: Group<T>[] = [];
    let currentGroup: Group<T> = {
      group: '',
      arr: [],
    };

    let currentGroupKey: string;
    arr.forEach((o) => {
      const key = getKey(o);
      if (key !== currentGroupKey) {
        if (currentGroup.arr.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = {
          group: '',
          arr: [],
        };
        currentGroup.group = key;
        currentGroupKey = key;
      }

      currentGroup.arr.push(o);
    });

    if (currentGroup.arr.length > 0) {
      currentGroup.group = currentGroupKey!;
      groups.push(currentGroup);
    }

    return groups;
  }

  // Set is iterated in insertion order https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#description
  const order: Set<string> = new Set();
  const group: Record<string, T[]> = {};

  arr.forEach((o) => {
    const key = getKey(o);
    // If group made add to that
    if (order.has(key)) {
      group[key].push(o);
    } else {
      // No group yet. Create new group and add group key to order
      group[key] = [o];
      order.add(key);
    }
  });

  if (returnAsDict) {
    return group;
  }

  const retVal: T[][] = [];
  order.forEach((groupKey) => retVal.push(group[groupKey]));
  return retVal;
};
