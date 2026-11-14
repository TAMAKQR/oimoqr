import { useEffect, useId, useRef } from 'react';

export const Modal = ({ isOpen, onClose, title, children, closeOnOverlayClick = true, maxWidth = 'max-w-lg' }) => {
    const titleId = useId();
    const dialogRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const previouslyFocused = document.activeElement;
        const previousBodyOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
            if (event.key === 'Tab' && dialogRef.current) {
                const focusable = Array.from(dialogRef.current.querySelectorAll(
                    'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
                ));
                if (focusable.length === 0) {
                    event.preventDefault();
                    dialogRef.current.focus();
                    return;
                }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);
        window.requestAnimationFrame(() => dialogRef.current?.focus());

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div
                className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm"
                onClick={handleClick}
                aria-hidden="true"
            />
            <div
                ref={dialogRef}
                tabIndex={-1}
                className={`relative w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-floating animate-fade-in ${maxWidth}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex min-h-[68px] items-center gap-3 border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur">
                    {title && <h2 id={titleId} className="pr-12 text-lg font-bold text-gray-950">{title}</h2>}
                    <button
                        onClick={onClose}
                        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
                        aria-label="Закрыть"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

export default Modal;
