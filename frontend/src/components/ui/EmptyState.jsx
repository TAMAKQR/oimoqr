import Button from './Button';

export const EmptyState = ({ icon = null, title = 'Здесь пока пусто', description, action, actionLabel }) => {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            {icon && (
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-2xl text-primary-500">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-neutral-500 mb-6 max-w-md px-4">{description}</p>
            )}
            {action && actionLabel && (
                <Button variant="primary" size="md" onClick={action}>
                    {actionLabel}
                </Button>
            )}
        </div>
    );
};

export default EmptyState;
