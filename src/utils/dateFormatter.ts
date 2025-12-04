import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export const formatDate = (date: Date | string | number): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd MMMM yyyy', { locale: id });
};

export const formatDateTime = (date: Date | string | number): string => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd MMMM yyyy HH:mm', { locale: id });
};
