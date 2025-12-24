"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface TriageCardProps {
  id: string;
  anonymousCode: string | null;
  symptoms: string;
  esiLevel: number;
  aiReasoning: string | null;
  criticalSigns: string[] | null;
  suggestedSpecialty: string | null;
  createdAt: string;
  onValidate: (
    id: string,
    nurseLevel?: number,
    overrideLevel?: number,
    feedback?: string,
    silent?: boolean
  ) => Promise<void>;
}

const ESI_LEVELS = [
  { value: "1", label: "ESI 1 - Crítico" },
  { value: "2", label: "ESI 2 - Emergencia" },
  { value: "3", label: "ESI 3 - Urgente" },
  { value: "4", label: "ESI 4 - Menos Urgente" },
  { value: "5", label: "ESI 5 - No Urgente" },
];

const ESI_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-red-500", text: "text-white", label: "Crítico" },
  2: { bg: "bg-orange-500", text: "text-white", label: "Emergencia" },
  3: { bg: "bg-yellow-500", text: "text-white", label: "Urgente" },
  4: { bg: "bg-blue-500", text: "text-white", label: "Menos Urgente" },
  5: { bg: "bg-green-500", text: "text-white", label: "No Urgente" },
};

export function TriageCard({
  id,
  anonymousCode,
  symptoms,
  esiLevel,
  aiReasoning,
  criticalSigns,
  suggestedSpecialty,
  createdAt,
  onValidate,
}: TriageCardProps) {
  const [nurseEstimation, setNurseEstimation] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedFinalLevel, setSelectedFinalLevel] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [showFullSymptoms, setShowFullSymptoms] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: es,
  });

  const handleClassify = async () => {
    try {
      setIsClassifying(true);
      const nurseLevel = parseInt(nurseEstimation);
      await onValidate(id, nurseLevel, undefined, undefined, true); // silent save
      
      // Mostrar animación de éxito
      setShowSuccessAnimation(true);
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setSelectedFinalLevel(nurseEstimation);
        setIsExpanded(true);
        setShowFullSymptoms(true);
      }, 800);
    } catch (error) {
      console.error("Error al clasificar:", error);
      setIsClassifying(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      const nurseLevel = parseInt(nurseEstimation);
      const finalLevel = parseInt(selectedFinalLevel);
      const overrideLevel = finalLevel !== nurseLevel ? finalLevel : undefined;

      await onValidate(id, undefined, overrideLevel, feedback || undefined, false);
      // El componente padre recargará y este caso desaparecerá
    } catch (error) {
      console.error("Error al confirmar:", error);
      setIsConfirming(false);
    }
  };

  const nurseMatchesAI = nurseEstimation === esiLevel.toString();

  return (
    <Card className="border-2 transition-all duration-300 hover:shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="text-2xl">👤</span>
              <span>Caso #{anonymousCode || id.slice(0, 8)}</span>
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {timeAgo}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Síntomas - Siempre visible */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Síntomas reportados:
          </Label>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 transition-all duration-300">
            <p className={`text-base leading-relaxed text-gray-900 transition-all duration-300 ${!showFullSymptoms && !isExpanded ? 'line-clamp-2' : ''}`}>
              {symptoms}
            </p>
            {symptoms.length > 150 && !isExpanded && (
              <button
                type="button"
                onClick={() => setShowFullSymptoms(!showFullSymptoms)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium underline transition-colors"
              >
                {showFullSymptoms ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        </div>

        {/* ESTADO 1: CLASIFICACIÓN CIEGA (antes de clasificar) */}
        {!isExpanded && (
          <div className="space-y-4 rounded-xl border-2 border-teal-500 bg-gradient-to-br from-teal-50 to-cyan-50 p-5 shadow-sm">
            <div className="flex items-start gap-3 pb-3 border-b border-teal-200">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center">
                <span className="text-xl">🔒</span>
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-teal-900 mb-1">
                  Clasificación Independiente
                </p>
                <p className="text-sm text-teal-700">
                  Clasifique al paciente según su criterio clínico profesional
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span className="text-lg">🩺</span>
                ¿Qué nivel ESI asignaría?
              </Label>
              <div className="grid grid-cols-5 gap-3">
                {ESI_LEVELS.map((level) => {
                  const color = ESI_COLORS[parseInt(level.value)];
                  const isSelected = nurseEstimation === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setNurseEstimation(level.value)}
                      disabled={isClassifying}
                      className={`
                        flex flex-col items-center justify-center p-5 rounded-2xl border-4 transition-all duration-200
                        min-h-[110px] touch-manipulation
                        ${isSelected 
                          ? `${color.bg} ${color.text} border-gray-900 scale-105 shadow-2xl ring-4 ring-offset-2 ring-gray-900` 
                          : 'bg-white border-gray-300 hover:border-gray-500 hover:shadow-lg hover:scale-102'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                        active:scale-95
                      `}
                    >
                      <div className={`text-4xl font-black mb-2 ${isSelected ? color.text : 'text-gray-900'}`}>
                        {level.value}
                      </div>
                      <div className={`text-[10px] font-bold text-center leading-tight uppercase tracking-wide ${isSelected ? color.text : 'text-gray-600'}`}>
                        {color.label}
                      </div>
                    </button>
                  );
                })}
              </div>
              {!nurseEstimation && (
                <p className="text-xs text-teal-700 italic flex items-center gap-1 justify-center">
                  <span>👆</span>
                  <span>Toque un nivel ESI para clasificar</span>
                </p>
              )}
            </div>

            <Button
              onClick={handleClassify}
              disabled={!nurseEstimation || isClassifying || showSuccessAnimation}
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 transition-all duration-300"
            >
              {showSuccessAnimation ? (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5 animate-bounce" />
                  ¡Clasificación Guardada!
                </>
              ) : isClassifying ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <span className="mr-2 text-xl">🔓</span>
                  Clasificar y Ver Comparación
                </>
              )}
            </Button>
          </div>
        )}

        {/* ESTADO 2: COMPARACIÓN (después de clasificar) */}
        {isExpanded && (
          <div className="space-y-5 animate-in fade-in duration-500">
            {/* Comparación lado a lado */}
            <div className="rounded-xl border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 p-5 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📊</span>
                <Label className="text-lg font-bold text-purple-900">
                  Comparación de Clasificaciones
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2 bg-white rounded-lg p-4 border-2 border-teal-500 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🩺</span>
                    <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Su Clasificación
                    </Label>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-teal-600 mb-1">
                      ESI {nurseEstimation}
                    </div>
                    <p className="text-xs text-gray-600">
                      {ESI_LEVELS.find(l => l.value === nurseEstimation)?.label.split(' - ')[1]}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 bg-white rounded-lg p-4 border-2 border-indigo-500 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🤖</span>
                    <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Clasificación IA
                    </Label>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-indigo-600 mb-1">
                      ESI {esiLevel}
                    </div>
                    <p className="text-xs text-gray-600">
                      {ESI_COLORS[esiLevel]?.label}
                    </p>
                  </div>
                </div>
              </div>

              {nurseMatchesAI ? (
                <div className="rounded-lg border-2 border-green-400 bg-green-50 p-3 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-900">
                      ¡Clasificaciones coinciden!
                    </p>
                    <p className="text-xs text-green-800">
                      Su criterio clínico es consistente con la sugerencia de la IA.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      Clasificaciones diferentes
                    </p>
                    <p className="text-xs text-amber-800">
                      Su criterio difiere de la IA. Puede mantener su clasificación o ajustarla.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Razonamiento de la IA */}
            {aiReasoning && (
              <div className="space-y-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧠</span>
                  <Label className="text-base font-bold text-indigo-900">
                    Razonamiento Clínico de la IA:
                  </Label>
                </div>
                <p className="rounded-lg bg-white border border-indigo-200 p-4 text-sm leading-relaxed text-gray-800">
                  {aiReasoning}
                </p>
              </div>
            )}

            {/* Signos críticos */}
            {criticalSigns && criticalSigns.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <span>⚠️</span>
                  Signos críticos identificados:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {criticalSigns.map((sign, index) => (
                    <Badge key={index} variant="destructive" className="text-sm">
                      {sign}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Ajustar clasificación final */}
            <div className="space-y-3 rounded-xl border-2 border-gray-300 bg-gray-50 p-5">
              <Label className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span className="text-xl">✏️</span>
                Clasificación Final:
              </Label>
              <div className="grid grid-cols-5 gap-3">
                {ESI_LEVELS.map((level) => {
                  const color = ESI_COLORS[parseInt(level.value)];
                  const isSelected = selectedFinalLevel === level.value;
                  const wasOriginal = level.value === nurseEstimation;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setSelectedFinalLevel(level.value)}
                      disabled={isConfirming}
                      className={`
                        relative flex flex-col items-center justify-center p-5 rounded-2xl border-4 transition-all duration-200
                        min-h-[110px] touch-manipulation
                        ${isSelected 
                          ? `${color.bg} ${color.text} border-gray-900 scale-105 shadow-2xl ring-4 ring-offset-2 ring-gray-900` 
                          : 'bg-white border-gray-300 hover:border-gray-500 hover:shadow-lg hover:scale-102'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                        active:scale-95
                      `}
                    >
                      {wasOriginal && (
                        <div className="absolute -top-3 -right-3 bg-teal-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg border-2 border-white">
                          ✓
                        </div>
                      )}
                      <div className={`text-4xl font-black mb-2 ${isSelected ? color.text : 'text-gray-900'}`}>
                        {level.value}
                      </div>
                      <div className={`text-[10px] font-bold text-center leading-tight uppercase tracking-wide ${isSelected ? color.text : 'text-gray-600'}`}>
                        {color.label}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-1 pt-2">
                {selectedFinalLevel === nurseEstimation ? (
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                    <span>✓</span>
                    <span>Manteniendo su clasificación original</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Ha modificado su clasificación después de ver la IA</span>
                  </p>
                )}
              </div>
            </div>

            {/* Área de comentarios */}
            <div className="space-y-3 rounded-xl border-2 border-gray-300 bg-gray-50 p-4">
              <Label htmlFor={`feedback-${id}`} className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span className="text-xl">💬</span>
                Comentarios (Opcional):
              </Label>
              <Textarea
                id={`feedback-${id}`}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ej: Paciente presentaba signos de... / La IA no consideró... / Coincido porque..."
                className="min-h-[100px] resize-none border-2 text-base"
                disabled={isConfirming}
              />
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <span>📝</span>
                <span>Sus comentarios ayudan a mejorar el sistema</span>
              </p>
            </div>

            {/* Botón confirmar */}
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-6 w-6" />
                  Confirmar Validación
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
