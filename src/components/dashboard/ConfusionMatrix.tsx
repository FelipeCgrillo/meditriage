'use client';

import React from 'react';

interface ConfusionMatrixProps {
    matrix: number[][];
    labels?: string[];
    title?: string;
}

// Get color intensity based on value relative to max
function getCellColor(value: number, maxValue: number, isDiagonal: boolean): string {
    const intensity = Math.max(0.1, value / maxValue);

    if (isDiagonal) {
        // Diagonal cells - use emerald green gradient for correct predictions
        if (intensity > 0.7) return 'bg-emerald-700 text-white';
        if (intensity > 0.5) return 'bg-emerald-600 text-white';
        if (intensity > 0.3) return 'bg-emerald-500 text-white';
        if (intensity > 0.15) return 'bg-emerald-400 text-white';
        return 'bg-emerald-200 text-emerald-900';
    } else {
        // Off-diagonal cells - use blue/slate gradient for disagreements
        if (intensity > 0.3) return 'bg-slate-400 text-white';
        if (intensity > 0.15) return 'bg-slate-300 text-slate-800';
        if (intensity > 0.05) return 'bg-slate-200 text-slate-700';
        return 'bg-slate-100 text-slate-600';
    }
}

export function ConfusionMatrix({
    matrix,
    labels = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'],
    title = 'Matriz de Concordancia'
}: ConfusionMatrixProps) {
    // Find max value for color scaling
    const maxValue = Math.max(...matrix.flat());
    const diagonalMax = Math.max(...matrix.map((row, i) => row[i]));

    // Calculate row and column totals
    const rowTotals = matrix.map(row => row.reduce((a, b) => a + b, 0));
    const colTotals = matrix[0].map((_, i) => matrix.reduce((sum, row) => sum + row[i], 0));

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500 mt-1">Enfermero (Filas) vs. IA (Columnas)</p>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                    {/* Column headers */}
                    <div className="flex">
                        <div className="w-24 flex-shrink-0" /> {/* Corner spacer */}
                        <div className="flex-1 grid grid-cols-5 gap-1 mb-2">
                            {labels.map((label, i) => (
                                <div key={`col-${i}`} className="text-center">
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="w-12 flex-shrink-0 text-center">
                            <span className="text-xs font-medium text-gray-400">Total</span>
                        </div>
                    </div>

                    {/* Axis label */}
                    <div className="flex mb-1">
                        <div className="w-24 flex-shrink-0 flex items-center justify-end pr-3">
                            <span className="text-xs font-medium text-gray-400 tracking-wide">ENFERMERO →</span>
                        </div>
                        <div className="flex-1">
                            <div className="text-center">
                                <span className="text-xs font-medium text-gray-400 tracking-wide">↓ PREDICCIÓN IA</span>
                            </div>
                        </div>
                        <div className="w-12 flex-shrink-0" />
                    </div>

                    {/* Matrix rows */}
                    {matrix.map((row, i) => (
                        <div key={`row-${i}`} className="flex mb-1">
                            {/* Row header */}
                            <div className="w-24 flex-shrink-0 flex items-center justify-end pr-3">
                                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                    {labels[i]}
                                </span>
                            </div>

                            {/* Cells */}
                            <div className="flex-1 grid grid-cols-5 gap-1">
                                {row.map((value, j) => {
                                    const isDiagonal = i === j;
                                    const colorClass = getCellColor(
                                        value,
                                        isDiagonal ? diagonalMax : maxValue * 0.3,
                                        isDiagonal
                                    );

                                    return (
                                        <div
                                            key={`cell-${i}-${j}`}
                                            className={`
                        aspect-square flex items-center justify-center rounded-lg
                        font-semibold text-sm transition-transform hover:scale-105
                        ${colorClass}
                        ${isDiagonal ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}
                      `}
                                            title={`Enfermero: ${labels[i]}, IA: ${labels[j]} - ${value} pacientes`}
                                        >
                                            {value}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Row total */}
                            <div className="w-12 flex-shrink-0 flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-500">{rowTotals[i]}</span>
                            </div>
                        </div>
                    ))}

                    {/* Column totals */}
                    <div className="flex mt-2 pt-2 border-t border-gray-100">
                        <div className="w-24 flex-shrink-0 flex items-center justify-end pr-3">
                            <span className="text-xs font-medium text-gray-400">Total</span>
                        </div>
                        <div className="flex-1 grid grid-cols-5 gap-1">
                            {colTotals.map((total, i) => (
                                <div key={`col-total-${i}`} className="text-center">
                                    <span className="text-xs font-medium text-gray-500">{total}</span>
                                </div>
                            ))}
                        </div>
                        <div className="w-12 flex-shrink-0" />
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-600 ring-2 ring-emerald-400" />
                    <span className="text-gray-600">Concordancia (Diagonal)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-slate-300" />
                    <span className="text-gray-600">Discordancia</span>
                </div>
            </div>
        </div>
    );
}
