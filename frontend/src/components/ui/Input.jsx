import { useId } from 'react';

export const Input = ({ className, error, label, id: providedId, ...props }) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={id} className="text-sm font-semibold text-gray-800">{label}</label>
            )}
            <input
                id={id}
                aria-invalid={Boolean(error)}
                className={`min-h-11 w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition-all duration-200 placeholder:text-gray-400 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-gray-100 ${
                    error
                        ? 'border-error-500 focus:border-error-500 focus:ring-error-100'
                        : 'border-gray-300 focus:border-primary-500 focus:ring-primary-100'
                } ${className || ''}`}
                {...props}
            />
            {error && (
                <p className="text-xs text-error-600">{error}</p>
            )}
        </div>
    );
};

export default Input;
