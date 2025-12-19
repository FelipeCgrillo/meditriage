'use client';

import React from 'react';

interface ProgressBarProps {
    value: number; // 0-100
    label: string;
    variant?: 'default' | 'warning' | 'danger';
    showValue?: boolean;
}

const variantColors = {
    default: 'bg-blue-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
};

const variantBg = {
    default: 'bg-blue-100',
    warning: 'bg-amber-100',
    danger: 'bg-red-100',
};

export function ProgressBar({ value, label, variant = 'default', showValue = true }: ProgressBarProps) {
    const clampedValue = Math.max(0, Math.min(100, value));

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
                {showValue && (
                    <span className={`text-lg font-bold ${variant === 'danger' ? 'text-red-600' :
                            variant === 'warning' ? 'text-amber-600' :
                                'text-blue-600'
                        }`}>
                        {clampedValue.toFixed(1)}%
                    </span>
                )}
            </div>

            <div className={`relative h-6 rounded-full overflow-hidden ${variantBg[variant]}`}>
                {/* Progress fill */}
                <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${variantColors[variant]}`}
                    style={{ width: `${clampedValue}%` }}
                >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </div>

                {/* Scale markers */}
                <div className="absolute inset-0 flex justify-between px-1">
                    {[0, 25, 50, 75, 100].map((mark) => (
                        <div
                            key={mark}
                            className="w-px h-full bg-white/30"
                            style={{ marginLeft: mark === 0 ? 0 : undefined }}
                        />
                    ))}
                </div>
            </div>

            {/* Scale labels */}
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
            </div>
        </div>
    );
}
