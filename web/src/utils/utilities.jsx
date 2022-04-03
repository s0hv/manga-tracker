import { format, formatDistanceToNowStrict } from 'date-fns';
import enLocale from 'date-fns/locale/en-GB';
import throttle from 'lodash.throttle';
import { csrfHeader } from './csrf';

export const followUnfollow = (csrf, mangaId, serviceId) => {
  const url = serviceId ? `/api/user/follows?mangaId=${mangaId}&serviceId=${serviceId}` :
    `/api/user/follows?mangaId=${mangaId}`;
  return throttle((event) => {
    const target = event.target;
    switch (target.textContent.toLowerCase()) {
      case 'follow':
        fetch(url,
          {
            method: 'put',
            headers: csrfHeader(csrf),
          })
          .then(res => {
            if (res.status === 200) {
              target.textContent = 'Unfollow';
            }
          });
        break;

      case 'unfollow':
        fetch(url, {
          method: 'delete',
          headers: csrfHeader(csrf),
        })
          .then(res => {
            if (res.status === 200) {
              target.textContent = 'Follow';
            }
          });
        break;

      default:
        target.textContent = 'Follow';
    }
  }, 200, { trailing: false });
};

// This seems to be faster than a custom recursive function according to my measurements
export const jsonSerializable = (value) => JSON.parse(JSON.stringify(value));

function dateIsInvalid(date) {
  return !date || Number.isNaN(date.getTime()) || date.getTime() === 0;
}

export const defaultDateFormat = (date, ifUndefined='Unknown') => {
  if (dateIsInvalid(date)) return ifUndefined;

  return format(date, 'MMM do yyyy, HH:mm', { locale: enLocale });
};

export const defaultDateDistanceToNow = (date, ifUndefined='Unknown') => {
  if (dateIsInvalid(date)) return ifUndefined;

  return formatDistanceToNowStrict(date, { addSuffix: true });
};

export const noop = () => {};

/**
export const cmpBy = (arr, accessor, cmp) => {
  if (!arr || arr.length === 0) {
    return undefined;
  }
  let selectedIdx;
  let selectedVal;
  arr.forEach((item, idx) => {
    const val = accessor(item);
    if (selectedIdx === undefined || cmp(val, selectedVal)) {
      selectedIdx = idx;
      selectedVal = accessor(item);
    }
  });

  if (selectedIdx === undefined) {
    return undefined;
  }

  return arr[selectedIdx];
};

export const minBy = (arr, accessor) => cmpBy(arr, accessor, (a, b) => a < b);
export const maxBy = (arr, accessor) => cmpBy(arr, accessor, (a, b) => a > b);
*/

/**
 * Groups given data on a year by year basis ready for heatmaps
 * @param {Array} data in an array of objects. Each object should have timestamp
 * and count properties.
 * @returns {{}|*} Empty object if no data. Otherwise an object of Heatmap compatible data
 * with years as keys. For years in between without data an object { empty: true } is given
 */
export const groupByYear = (data) => {
  if (data === undefined) return {};
  let minYear;
  let maxYear;

  const grouped = data.reduce((o, r) => {
    const d = new Date(r.timestamp * 1000);
    const year = d.getFullYear();

    // Add new heatmap on a new year
    if (o[year] === undefined) {
      o[year] = {
        start: new Date(year, 0, 1), // Start of the year
        end: new Date(year, 11, 31, 23),
        total: r.count,
        dataPoints: {
          [r.timestamp.toString()]: r.count,
        },
      };
    // append to an existing heatmap
    } else {
      o[year].dataPoints[r.timestamp.toString()] = r.count;
      o[year].total += r.count;
    }

    if (minYear === undefined || year < minYear) {
      minYear = year;
    } else if (maxYear === undefined || year > maxYear) {
      maxYear = year;
    }

    return o;
  }, {});

  minYear = minYear || 0;
  maxYear = maxYear || minYear || 0;
  for (let i = minYear; i <= maxYear; i++) {
    if (grouped[i] === undefined) {
      grouped[i] = {
        empty: true,
      };
    }
  }

  const now = new Date(Date.now());
  if (maxYear === now.getFullYear() && grouped[maxYear]) {
    grouped[maxYear].end = now;
  }
  return grouped;
};

export const statusToString = (status) => {
  switch (status) {
    case 1:
      return 'Completed';
    case 2:
      return 'Dropped';
    case 3:
      return 'Hiatus';
    default:
      return 'Ongoing';
  }
};

export const isInteger = (s) => (
  Number.isInteger(s) ||
  /^\d+$/.test(s)
);


/**
 * This callback type is called `requestCallback` and is displayed as a global symbol.
 *
 * @callback groupByGetKey
 * @param {any} value
 */

/**
 *
 * @param {any[]} arr
 * @param {string|groupByGetKey} getKey Either an object property name or a function that returns the group key
 * @param {object} options
 * @param {boolean} options.keepOrder If true the order of the array will be kept the same
 * meaning the same key can be grouped multiple times
 */
export const groupBy = (arr, getKey, { keepOrder = true } = {}) => {
  if (!Array.isArray(arr)) {
    throw new TypeError('Input must be an array');
  }

  if (arr.length === 0) {
    return [];
  }

  if (typeof getKey === 'string') {
    const _key = getKey;
    getKey = (o) => o[_key];
  }

  if (keepOrder) {
    const groups = [];
    let currentGroup = [];
    let currentGroupKey;
    arr.forEach((o) => {
      const key = getKey(o);
      if (key !== currentGroupKey) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [];
        currentGroup.group = key;
        currentGroupKey = key;
      }

      currentGroup.push(o);
    });

    if (currentGroup.length > 0) {
      currentGroup.group = currentGroupKey;
      groups.push(currentGroup);
    }

    return groups;
  }

  // Set is iterated in insertion order https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#description
  const order = new Set();
  const group = {};

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

  const retVal = [];
  order.forEach((groupKey) => retVal.push(group[groupKey]));
  return retVal;
};

/**
 * Turns camelCase into snake_case
 * @param {String} s
 */
export const snakeCase = (s) => s.replace(/[A-Z]/g, letter => `_${letter[0].toLowerCase()}`);

export const buildNotificationData = (values) => ({
  notificationId: values.notificationId,
  useFollows: values.useFollows,

  groupByManga: values.groupByManga,
  destination: values.destination,
  name: values.name,

  disabled: values.disabled,

  manga: values.useFollows ?
    undefined :
    values.manga.map(m => ({ mangaId: m.mangaId, serviceId: m.serviceId })),
});


/**
 * Field
 * @typedef {Object} Field
 * @property {string} name Name of the field
 * @property {string} value Value of the field
 * @property {boolean} optional Indicates whether the field is optional
 */

/**
 *
 * @param fields {Array<Field>} List of fields
 * @param property {string} Which property of the field to map
 * @returns {Object}
 */
export const mapNotificationFields = (fields, property = 'value') => {
  if (!Array.isArray(fields)) return {};

  return fields.reduce((prev, curr) => ({
    ...prev,
    [curr.name]: curr[property],
  }), {});
};
