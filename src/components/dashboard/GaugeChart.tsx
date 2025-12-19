'use client';

import React from 'react';

interface GaugeChartProps {
    value: number; // 0-100 percentage
    threshold: number; // danger threshold
    title: string;
    subtitle?: string;
}

export function GaugeChart({ value, threshold, title, subtitle }: GaugeChartProps) {
    // SVG parameters
    const size = 200;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;

    // Arc calculations (semicircle from 180° to 0°)
    const startAngle = 180;
    const endAngle = 0;
    const totalAngle = startAngle - endAngle;

    // Value position (clamped to 0-100)
    const clampedValue = Math.max(0, Math.min(100, value));
    const valueAngle = startAngle - (clampedValue / 100) * totalAngle;

    // Threshold position
    const thresholdAngle = startAngle - (threshold / 100) * totalAngle;

    // Convert angle to coordinates
    const angleToCoords = (angle: number) => {
        const rad = (angle * Math.PI) / 180;
        return {
            x: center + radius * Math.cos(rad),
            y: center - radius * Math.sin(rad),
        };
    };

    // Create arc path
    const createArc = (startDeg: number, endDeg: number) => {
        const start = angleToCoords(startDeg);
        const end = angleToCoords(endDeg);
        const largeArc = startDeg - endDeg > 180 ? 1 : 0;
        return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
    };

    // Needle position
    const needleEnd = angleToCoords(valueAngle);
    const needleLength = radius - 15;
    const needleRad = (valueAngle * Math.PI) / 180;
    const needleTip = {
        x: center + needleLength * Math.cos(needleRad),
        y: center - needleLength * Math.sin(needleRad),
    };

    // Status
    const isInDanger = value > threshold;
    const statusColor = isInDanger ? 'text-red-600' : 'text-emerald-600';
    const statusText = isInDanger ? 'ALERTA' : 'ACEPTABLE';

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="mb-2 text-center">
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>

            <div className="relative flex justify-center">
                <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
                    {/* Background track */}
                    <path
                        d={createArc(startAngle, endAngle)}
                        fill="none"
                        stroke="#E5E7EB"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Safe zone (green) - from 0 to threshold */}
                    <path
                        d={createArc(startAngle, thresholdAngle)}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        opacity={0.8}
                    />

                    {/* Danger zone (red) - from threshold to 100 */}
                    <path
                        d={createArc(thresholdAngle, endAngle)}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        opacity={0.8}
                    />

                    {/* Threshold marker */}
                    <circle
                        cx={angleToCoords(thresholdAngle).x}
                        cy={angleToCoords(thresholdAngle).y}
                        r={4}
                        fill="#FFF"
                        stroke="#374151"
                        strokeWidth={2}
                    />

                    {/* Needle */}
                    <line
                        x1={center}
                        y1={center}
                        x2={needleTip.x}
                        y2={needleTip.y}
                        stroke={isInDanger ? '#EF4444' : '#374151'}
                        strokeWidth={3}
                        strokeLinecap="round"
                    />

                    {/* Needle center */}
                    <circle
                        cx={center}
                        cy={center}
                        r={8}
                        fill={isInDanger ? '#EF4444' : '#374151'}
                    />
                    <circle
                        cx={center}
                        cy={center}
                        r={4}
                        fill="#FFF"
                    />

                    {/* Labels */}
                    <text x={15} y={center + 20} className="text-[10px] fill-gray-400">0%</text>
                    <text x={size - 30} y={center + 20} className="text-[10px] fill-gray-400">100%</text>

                    {/* Value display */}
                    <text
                        x={center}
                        y={center + 25}
                        textAnchor="middle"
                        className={`text-2xl font-bold ${isInDanger ? 'fill-red-600' : 'fill-gray-900'}`}
                    >
                        {value.toFixed(1)}%
                    </text>
                </svg>
            </div>

            {/* Status badge */}
            <div className="mt-2 flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${isInDanger
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${isInDanger ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    {statusText}
                </span>
            </div>

            {/* Threshold label */}
            <p className="mt-2 text-center text-[10px] text-gray-400">
                Umbral de seguridad: {threshold}%
            </p>
        </div>
    );
}
