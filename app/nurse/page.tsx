import { NurseValidation } from '@/components/NurseValidation';

export const metadata = {
    title: 'Dashboard de Enfermería - Sistema de Triaje',
    description: 'Panel de validación de triaje para personal de enfermería',
    robots: 'noindex, nofollow',
};

export default function NursePage() {
    return <NurseValidation />;
}
