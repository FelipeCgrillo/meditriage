'use client';

import React from 'react';

interface StatCardProps {
    value: string | number;
    label: string;
    icon?: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'highlight';
    badge?: string;
    subtext?: string;
}

const variantStyles = {
    default: {
        card: 'bg-white border-gray-200',
        value: 'text-gray-900',
        accent: 'bg-blue-50',
        icon: 'text-blue-600',
    },
    success: {
        card: 'bg-white border-emerald-200',
        value: 'text-emerald-700',
        accent: 'bg-emerald-50',
        icon: 'text-emerald-600',
    },
    warning: {
        card: 'bg-white border-amber-200',
        value: 'text-amber-700',
        accent: 'bg-amber-50',
        icon: 'text-amber-600',
    },
    danger: {
        card: 'bg-gradient-to-br from-red-50 to-red-100 border-red-300',
        value: 'text-red-700',
        accent: 'bg-red-100',
        icon: 'text-red-600',
    },
    highlight: {
        card: 'bg-gradient-to-br from-blue-900 to-indigo-900 border-blue-700',
        value: 'text-amber-400',
        accent: 'bg-blue-800/50',
        icon: 'text-amber-400',
    },
};

export function StatCard({ value, label, icon, variant = 'default', badge, subtext }: StatCardProps) {
    const styles = variantStyles[variant];
    const isHighlight = variant === 'highlight';

    return (
        <div className={`relative rounded-2xl border-2 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 ${styles.card}`}>
            {/* Icon container */}
            {icon && (
                <div className={`absolute top-4 right-4 p-2 rounded-xl ${styles.accent}`}>
                    <span className={styles.icon}>{icon}</span>
                </div>
            )}

            {/* Main value */}
            <div className="space-y-1">
                <p className={`text-4xl font-bold tracking-tight ${styles.value}`}>
                    {value}
                </p>
                <p className={`text-sm font-medium ${isHighlight ? 'text-blue-200' : 'text-gray-500'}`}>
                    {label}
                </p>
            </div>

            {/* Badge */}
            {badge && (
                <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${variant === 'highlight'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : variant === 'danger'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                    {badge}
                </div>
            )}

            {/* Subtext */}
            {subtext && (
                <p className={`mt-2 text-xs ${isHighlight ? 'text-blue-300' : 'text-gray-400'}`}>
                    {subtext}
                </p>
            )}
        </div>
    );
}
