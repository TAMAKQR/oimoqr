export const Badge = ({ className, variant = 'neutral', children, ...props }) => {
    const variants = {
        success: 'bg-success-50 text-success-600 border border-success-100',
        warning: 'bg-warning-50 text-warning-600 border border-warning-100',
        error: 'bg-error-50 text-error-600 border border-error-100',
        info: 'bg-info-50 text-info-600 border border-info-100',
        neutral: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
        primary: 'bg-primary-50 text-primary-600 border border-primary-100',
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${variants[variant]} ${className || ''}`}
            {...props}
        >
            {children}
        </span>
    );
};

export default Badge;

export const StatusBadge = ({ status, className }) => {
    const statusMap = {
        new: { variant: 'info', label: 'Новый' },
        confirmed: { variant: 'info', label: 'Подтверждён' },
        preparing: { variant: 'warning', label: 'Готовится' },
        ready: { variant: 'success', label: 'Готов' },
        out_for_delivery: { variant: 'info', label: 'В доставке' },
        delivered: { variant: 'success', label: 'Доставлен' },
        completed: { variant: 'success', label: 'Завершён' },
        cancelled: { variant: 'error', label: 'Отменён' },
        pending_payment: { variant: 'warning', label: 'Ожидает оплату' },
        active: { variant: 'success', label: 'Активен' },
        expired: { variant: 'error', label: 'Истёк' },
        trial: { variant: 'info', label: 'Пробный период' },
    };

    const config = statusMap[status] || { variant: 'neutral', label: status || '—' };

    return (
        <Badge variant={config.variant} className={className}>
            {config.label}
        </Badge>
    );
};
