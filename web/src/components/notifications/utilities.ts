import { NotificationFollow } from '@/types/api/notifications';

export const showAll = <T, >(o: T) => o;
export const noData: any[] = [];


export const optionEquals = (option: NotificationFollow, value: NotificationFollow) => (
  option.mangaId === value.mangaId &&
  (value.serviceId === null || option.serviceId === value.serviceId)
);
export const getOptionLabel = ({ title, serviceName }: NotificationFollow) => `${title} | ${serviceName}`;
export const groupByKey = ({ mangaId, title }: NotificationFollow) => `${mangaId} ${title}`;
