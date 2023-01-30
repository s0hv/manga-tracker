import { format, formatDistanceToNowStrict } from 'date-fns';
import enLocale from 'date-fns/locale/en-GB';
import throttle from 'lodash.throttle';
import type { MouseEvent, MouseEventHandler } from 'react';
import { csrfHeader } from './csrf';
import type { DatabaseId, MangaId } from '@/types/dbTypes';
import type { FormValues } from '@/components/notifications/types';
import type { NotificationField } from '@/types/api/notifications';

export const followUnfollow = (csrf: string, mangaId: MangaId, serviceId: DatabaseId | null): MouseEventHandler => {
  const url = serviceId ? `/api/user/follows?mangaId=${mangaId}&serviceId=${serviceId}` :
    `/api/user/follows?mangaId=${mangaId}`;
  return throttle((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    switch (target?.textContent?.toLowerCase()) {
      case 'follow':
        fetch(url,
          {
            method: 'put',
            headers: csrfHeader(csrf),
          })
          .then(res => {
            if (res.status === 200) {
              target.textContent = 'Unfollow';
              if (target.ariaLabel) {
                target.ariaLabel = target.ariaLabel.replace(/follow/i, 'unfollow');
              }
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
              if (target.ariaLabel) {
                target.ariaLabel = target.ariaLabel.replace(/unfollow/i, 'follow');
              }
            }
          });
        break;

      default:
        target.textContent = 'Follow';
        if (target.ariaLabel) {
          target.ariaLabel = target.ariaLabel.replace(/unfollow/i, 'follow');
        }
    }
  }, 200, { trailing: false });
};

// This seems to be faster than a custom recursive function according to my measurements
export const jsonSerializable = (value: any) => JSON.parse(JSON.stringify(value));

function dateIsInvalid(date?: Date | null): boolean {
  return !date || Number.isNaN(date.getTime()) || date.getTime() === 0;
}

export const defaultDateFormat = (date?: Date | null, ifUndefined='Unknown'): string => {
  if (dateIsInvalid(date)) return ifUndefined;

  return format(date!, 'MMM do yyyy, HH:mm', { locale: enLocale });
};

export const defaultDateDistanceToNow = (date?: Date, ifUndefined='Unknown'): string => {
  if (dateIsInvalid(date)) return ifUndefined;

  return formatDistanceToNowStrict(date!, { addSuffix: true });
};

export type Noop = (..._: any) => void;
export const noop: Noop = () => {};

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

export interface GroupedYearData {
  timestamp: number,
  count: number
}

export interface GroupedYear {
  start: Date,
  end: Date,
  total: number,
  dataPoints: {
    [key: string]: number
  }
}

export type GroupedYears = {
  [key: string]: GroupedYear | { empty: true }
}

/**
 * Groups given data on a year by year basis ready for heatmaps
 * @param {Array} data in an array of objects. Each object should have timestamp
 * and count properties.
 * @returns {{}|*} Empty object if no data. Otherwise an object of Heatmap compatible data
 * with years as keys. For years in between without data an object { empty: true } is given
 */
export const groupByYear = (data: GroupedYearData[]): GroupedYears => {
  if (data === undefined) return {};
  let minYear: number | undefined;
  let maxYear: number | undefined;

  const grouped: GroupedYears = data.reduce((o, r) => {
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
  }, {} as Record<number, GroupedYear>);

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
    (grouped[maxYear] as GroupedYear).end = now;
  }
  return grouped;
};

export const statusToString = (status: number | string) => {
  switch (Number(status)) {
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

export const isInteger = (s: any) => (
  Number.isInteger(s) ||
  /^-?\d+$/.test(s)
);


/**
 * This callback type is called `requestCallback` and is displayed as a global symbol.
 *
 * @callback groupByGetKey
 * @param {any} value
 */

export type Group<T> = {
  group: string
  arr: T[]
}

/**
 * Turns camelCase into snake_case
 * @param {String} s
 */
export const snakeCase = (s: string) => s.replace(/[A-Z]/g, letter => `_${letter[0].toLowerCase()}`);

export const buildNotificationData = (values: FormValues<any>) => ({
  notificationId: values.notificationId,
  useFollows: values.useFollows,

  groupByManga: values.groupByManga,
  destination: values.destination,
  name: values.name,

  disabled: values.disabled,

  manga: values.useFollows ?
    undefined :
    values.manga.map((m: any) => ({ mangaId: m.mangaId, serviceId: m.serviceId })),
});


export type MappedNotificationField<T> = {
  [key: string]: T
}

/**
 *
 * @param fields {Array<NotificationField>} List of fields
 * @param property {string} Which property of the field to map
 * @returns {Object}
 */
export const mapNotificationFields = <K extends keyof NotificationField = 'value'>(fields: NotificationField[], property: K= 'value' as K): MappedNotificationField<NotificationField[K]> => {
  if (!Array.isArray(fields)) return {};

  return fields.reduce((prev, curr) => ({
    ...prev,
    [curr.name]: curr[property],
  }), {});
};


export const enumValues = <T extends object>(enumObj: T): string[] => {
  return Object
    .keys(enumObj)
    .filter(key => !Number.isNaN(Number(key)));
};
