import { format, formatDistanceToNowStrict } from 'date-fns';
import enLocale from 'date-fns/locale/en-GB';
import throttle from 'lodash.throttle';


// eslint-disable-next-line import/prefer-default-export
export const followUnfollow = (mangaId, serviceId) => {
  const url = serviceId ? `/api/user/follows?manga_id=${mangaId}&service_id=${serviceId}` :
                           `/api/user/follows?manga_id=${mangaId}`;
  return throttle((event) => {
    const target = event.target;
    switch (target.textContent.toLowerCase()) {
      case 'follow':
        fetch(url, { credentials: 'include', method: 'put' })
            .then(res => {
              if (res.status === 200) {
                target.textContent = 'Unfollow';
              }
            });
        break;

      case 'unfollow':
        fetch(url, { credentials: 'include', method: 'delete' })
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

// This seems to be faster than a custom recursive function  according to my measurements
export function jsonSerializable(value) {
  return JSON.parse(JSON.stringify(value));
}

export function defaultDateFormat(date, ifUndefined='Unknown') {
  if (!date || Number.isNaN(date.getTime())) return ifUndefined;

  format(date, 'MMM do, HH:mm', { locale: enLocale });
}

export function defaultDateDistanceToNow(date, ifUndefined='Unknown') {
  if (!date || Number.isNaN(date.getTime())) return ifUndefined;

  return formatDistanceToNowStrict(date, { addSuffix: true });
}
