'use client';

import React from 'react';

interface BarData {
    label: string;
    value: number;
    color?: string;
}

interface BarChartProps {
    data: BarData[];
    title: string;
    subtitle?: string;
    maxValue?: number;
    showValues?: boolean;
    valueFormat?: (value: number) => string;
}

const defaultColors = [
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
];

export function BarChart({
    data,
    title,
    subtitle,
    maxValue: customMax,
    showValues = true,
    valueFormat = (v) => `${v.toFixed(1)}%`
}: BarChartProps) {
    const maxValue = customMax ?? Math.max(...data.map(d => d.value)) * 1.1;

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm h-full">
            <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>

            <div className="space-y-4">
                {data.map((item, index) => {
                    const percentage = (item.value / maxValue) * 100;
                    const colorClass = item.color || defaultColors[index % defaultColors.length];

                    return (
                        <div key={item.label} className="group">
                            {/* Label and value row */}
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                {showValues && (
                                    <span className="text-sm font-bold text-gray-900">
                                        {valueFormat(item.value)}
                                    </span>
                                )}
                            </div>

                            {/* Bar */}
                            <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-500 ease-out ${colorClass} group-hover:opacity-90`}
                                    style={{ width: `${percentage}%` }}
                                >
                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10" />
                                </div>

                                {/* Inner value label for long bars */}
                                {percentage > 40 && showValues && (
                                    <div className="absolute inset-0 flex items-center px-3">
                                        <span className="text-xs font-semibold text-white drop-shadow">
                                            {valueFormat(item.value)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Reference line for 80% threshold (if applicable) */}
            <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-emerald-500" />
                        <span>≥85% Excelente</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-amber-500" />
                        <span>70-84% Bueno</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span>&lt;70% Revisar</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
