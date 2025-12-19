'use client';

// =============================================================================
// MOCK DATA GENERATOR FOR CLINICAL VALIDATION STUDY
// Simulates 1000 patient records with AI vs Nurse ESI classifications
// =============================================================================

export interface PatientRecord {
    anonymous_id: string;
    ai_esi_level: 1 | 2 | 3 | 4 | 5;
    nurse_esi_level: 1 | 2 | 3 | 4 | 5;
    patient_gender: 'M' | 'F';
    patient_age_group: 'Pediatric' | 'Adult' | 'Geriatric';
}

export interface StudyMetrics {
    totalPatients: number;
    exactAccuracy: number;
    kappaCoefficient: number;
    subTriageRate: number;
    overTriageRate: number;
    confusionMatrix: number[][];
    accuracyByGender: { male: number; female: number };
    accuracyByAgeGroup: { pediatric: number; adult: number; geriatric: number };
}

// Seeded random for reproducibility
function seededRandom(seed: number) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// Generate realistic patient records with controlled accuracy
export function generateMockData(n: number = 1000, seed: number = 42): PatientRecord[] {
    const records: PatientRecord[] = [];
    let currentSeed = seed;

    // Distribution weights for ESI levels (realistic ER distribution)
    // ESI 1: ~2%, ESI 2: ~15%, ESI 3: ~40%, ESI 4: ~30%, ESI 5: ~13%
    const esiWeights = [0.02, 0.15, 0.40, 0.30, 0.13];
    const cumulativeWeights = esiWeights.reduce((acc, w, i) => {
        acc.push((acc[i - 1] || 0) + w);
        return acc;
    }, [] as number[]);

    for (let i = 0; i < n; i++) {
        // Generate nurse ESI (ground truth)
        const rand = seededRandom(currentSeed++);
        let nurseEsi: 1 | 2 | 3 | 4 | 5 = 3;
        for (let j = 0; j < 5; j++) {
            if (rand <= cumulativeWeights[j]) {
                nurseEsi = (j + 1) as 1 | 2 | 3 | 4 | 5;
                break;
            }
        }

        // Generate AI ESI with ~88.5% exact match rate
        const matchRand = seededRandom(currentSeed++);
        let aiEsi: 1 | 2 | 3 | 4 | 5;

        if (matchRand < 0.885) {
            // Exact match
            aiEsi = nurseEsi;
        } else if (matchRand < 0.935) {
            // Off by 1 (over-triage - AI classifies more urgent)
            aiEsi = Math.max(1, nurseEsi - 1) as 1 | 2 | 3 | 4 | 5;
        } else {
            // Off by 1 (sub-triage - AI classifies less urgent) - DANGEROUS
            aiEsi = Math.min(5, nurseEsi + 1) as 1 | 2 | 3 | 4 | 5;
        }

        // Generate demographics
        const genderRand = seededRandom(currentSeed++);
        const gender: 'M' | 'F' = genderRand < 0.48 ? 'M' : 'F';

        const ageRand = seededRandom(currentSeed++);
        let ageGroup: 'Pediatric' | 'Adult' | 'Geriatric';
        if (ageRand < 0.15) {
            ageGroup = 'Pediatric';
        } else if (ageRand < 0.70) {
            ageGroup = 'Adult';
        } else {
            ageGroup = 'Geriatric';
        }

        records.push({
            anonymous_id: `PAC-2025-${String(i + 1).padStart(4, '0')}`,
            ai_esi_level: aiEsi,
            nurse_esi_level: nurseEsi,
            patient_gender: gender,
            patient_age_group: ageGroup,
        });
    }

    return records;
}

// Calculate Cohen's Kappa coefficient
function calculateKappa(matrix: number[][], n: number): number {
    // Observed agreement
    let po = 0;
    for (let i = 0; i < 5; i++) {
        po += matrix[i][i];
    }
    po /= n;

    // Expected agreement
    let pe = 0;
    for (let i = 0; i < 5; i++) {
        let rowSum = 0;
        let colSum = 0;
        for (let j = 0; j < 5; j++) {
            rowSum += matrix[i][j];
            colSum += matrix[j][i];
        }
        pe += (rowSum / n) * (colSum / n);
    }

    // Kappa
    return (po - pe) / (1 - pe);
}

// Calculate all study metrics
export function calculateMetrics(records: PatientRecord[]): StudyMetrics {
    const n = records.length;

    // Initialize confusion matrix [nurse][ai]
    const matrix: number[][] = Array(5).fill(null).map(() => Array(5).fill(0));

    let exactMatches = 0;
    let subTriageCount = 0; // AI says less urgent than nurse (dangerous)
    let overTriageCount = 0; // AI says more urgent than nurse

    // Gender accuracy
    const genderStats = { M: { correct: 0, total: 0 }, F: { correct: 0, total: 0 } };

    // Age group accuracy
    const ageStats = {
        Pediatric: { correct: 0, total: 0 },
        Adult: { correct: 0, total: 0 },
        Geriatric: { correct: 0, total: 0 },
    };

    for (const record of records) {
        const nurseIdx = record.nurse_esi_level - 1;
        const aiIdx = record.ai_esi_level - 1;

        matrix[nurseIdx][aiIdx]++;

        if (record.ai_esi_level === record.nurse_esi_level) {
            exactMatches++;
            genderStats[record.patient_gender].correct++;
            ageStats[record.patient_age_group].correct++;
        }

        // Sub-triage: AI ESI > Nurse ESI (higher number = less urgent)
        if (record.ai_esi_level > record.nurse_esi_level) {
            subTriageCount++;
        }

        // Over-triage: AI ESI < Nurse ESI
        if (record.ai_esi_level < record.nurse_esi_level) {
            overTriageCount++;
        }

        genderStats[record.patient_gender].total++;
        ageStats[record.patient_age_group].total++;
    }

    return {
        totalPatients: n,
        exactAccuracy: (exactMatches / n) * 100,
        kappaCoefficient: calculateKappa(matrix, n),
        subTriageRate: (subTriageCount / n) * 100,
        overTriageRate: (overTriageCount / n) * 100,
        confusionMatrix: matrix,
        accuracyByGender: {
            male: (genderStats.M.correct / genderStats.M.total) * 100,
            female: (genderStats.F.correct / genderStats.F.total) * 100,
        },
        accuracyByAgeGroup: {
            pediatric: (ageStats.Pediatric.correct / ageStats.Pediatric.total) * 100,
            adult: (ageStats.Adult.correct / ageStats.Adult.total) * 100,
            geriatric: (ageStats.Geriatric.correct / ageStats.Geriatric.total) * 100,
        },
    };
}

// Interpret Kappa value
export function interpretKappa(kappa: number): string {
    if (kappa < 0) return 'Sin Acuerdo';
    if (kappa < 0.20) return 'Acuerdo Leve';
    if (kappa < 0.40) return 'Acuerdo Justo';
    if (kappa < 0.60) return 'Acuerdo Moderado';
    if (kappa < 0.80) return 'Acuerdo Sustancial';
    return 'Acuerdo Casi Perfecto';
}

// Export to CSV
export function exportToCSV(records: PatientRecord[]): void {
    const headers = ['ID Anónimo', 'ESI IA', 'ESI Enfermero', 'Género', 'Grupo Etario', 'Concordancia'];

    const rows = records.map(r => [
        r.anonymous_id,
        r.ai_esi_level,
        r.nurse_esi_level,
        r.patient_gender === 'M' ? 'Masculino' : 'Femenino',
        r.patient_age_group === 'Pediatric' ? 'Pediátrico' :
            r.patient_age_group === 'Adult' ? 'Adulto' : 'Geriátrico',
        r.ai_esi_level === r.nurse_esi_level ? 'Sí' : 'No'
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estudio_validacion_triage_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
