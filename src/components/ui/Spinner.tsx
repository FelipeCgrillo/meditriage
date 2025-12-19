import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

export function Spinner({ size = 'md', label = 'Analizando síntomas...' }: SpinnerProps) {
    const sizeStyles = {
        sm: 'w-8 h-8',
        md: 'w-16 h-16',
        lg: 'w-24 h-24',
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4" role="status" aria-label={label}>
            <div className={`${sizeStyles[size]} relative`}>
                {/* Outer ring */}
                <div className="absolute inset-0 border-4 border-medical-primary/30 rounded-full"></div>

                {/* Spinning ring */}
                <div className="absolute inset-0 border-4 border-transparent border-t-medical-primary border-r-medical-primary rounded-full animate-spin"></div>

                {/* Medical cross icon in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-1/2 h-1/2 text-medical-primary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                </div>
            </div>

            <p className="text-medical-neutral font-medium text-center">{label}</p>
        </div>
    );
}
