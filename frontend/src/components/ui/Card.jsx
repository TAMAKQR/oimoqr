export const Card = ({ className, children, ...props }) => {
    return (
        <div
            className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className || ''}`}
            {...props}
        >
            {children}
        </div>
    );
};

export default Card;

export const CardHeader = ({ className, children, ...props }) => {
    return (
        <div className={`mb-4 ${className || ''}`} {...props}>
            {children}
        </div>
    );
};

export const CardBody = ({ className, children, ...props }) => {
    return (
        <div className={`flex-1 ${className || ''}`} {...props}>
            {children}
        </div>
    );
};

export const CardFooter = ({ className, children, ...props }) => {
    return (
        <div className={`mt-4 flex items-center gap-3 ${className || ''}`} {...props}>
            {children}
        </div>
    );
};
