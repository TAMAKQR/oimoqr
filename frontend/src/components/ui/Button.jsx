import { forwardRef } from 'react';

const buttonVariants = {
    primary: 'bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:shadow-md',
    secondary: 'bg-white text-primary-700 border border-primary-200 shadow-sm hover:bg-primary-50 hover:border-primary-300',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
    success: 'bg-success-600 text-white shadow-sm hover:bg-success-700 hover:shadow-md',
    danger: 'bg-error-600 text-white shadow-sm hover:bg-error-700 hover:shadow-md',
    outline: 'bg-transparent border border-neutral-200 text-neutral-700 hover:bg-neutral-50',
};

export const Button = forwardRef(({ className, variant = 'primary', size = 'md', disabled, loading, children, ...props }, ref) => {
    const base = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';
    const sizes = {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-5 py-3 text-base',
    };
    const variantClass = buttonVariants[variant];

    return (
        <button
            ref={ref}
            disabled={disabled || loading}
            className={`${base} ${sizes[size]} ${variantClass} ${className || ''}`}
            {...props}
        >
            {loading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm0 0V12" />
                </svg>
            )}
            {children}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
