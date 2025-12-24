"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";

import { Database } from "@/lib/supabase/types";
import { extractAIResponse } from "@/lib/utils/triage";
import { Textarea } from "@/components/ui/textarea";

type TriageRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

interface ValidationDialogProps {
  record: TriageRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (
    id: string,
    nurseLevel?: number,
    overrideLevel?: number,
    feedback?: string,
    silent?: boolean
  ) => Promise<void>;
  isValidating?: boolean;
}

const ESI_LEVELS = [
  { value: "1", label: "ESI 1 - Crítico" },
  { value: "2", label: "ESI 2 - Emergencia" },
  { value: "3", label: "ESI 3 - Urgente" },
  { value: "4", label: "ESI 4 - Menos Urgente" },
  { value: "5", label: "ESI 5 - No Urgente" },
];

export function ValidationDialog({
  record,
  open,
  onOpenChange,
  onValidate,
  isValidating = false,
}: ValidationDialogProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>(record.esi_level.toString());
  const [feedback, setFeedback] = useState<string>(record.feedback_enfermero || "");
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  // 🔒 BLIND VALIDATION: Ocultar clasificación de IA hasta que enfermera clasifique
  const [isRevealed, setIsRevealed] = useState(false);
  const [nurseEstimation, setNurseEstimation] = useState<string>("");

  const aiData = extractAIResponse(record);

  // Reset blind validation states when dialog opens or record changes
  useEffect(() => {
    if (open) {
      setIsRevealed(false);
      setNurseEstimation("");
      setSelectedLevel(record.esi_level.toString());
      setFeedback(record.feedback_enfermero || "");
      setIsConfirmed(false);
    }
  }, [open, record.id, record.esi_level, record.feedback_enfermero]);

  const handleConfirm = async () => {
    // 🔒 FASE 1: BLIND VALIDATION - Guardar clasificación independiente de enfermera
    if (!isRevealed) {
      if (!nurseEstimation) {
        return; // No hacer nada si no ha seleccionado nivel
      }
      
      try {
        // 🔥 CRÍTICO: Guardar nurse_esi_level en la BD (silenciosamente para no bloquear UI)
        const nurseLevel = parseInt(nurseEstimation);
        await onValidate(
          record.id,
          nurseLevel,      // nurse_esi_level (clasificación independiente)
          undefined,       // nurse_override_level (aún no aplica)
          undefined,       // feedback (aún no aplica)
          true             // silent (no mostrar toast)
        );
        
        // Actualizar estado local y revelar la IA
        setSelectedLevel(nurseEstimation);
        setIsRevealed(true);
      } catch (error) {
        console.error("Error guardando clasificación de enfermera:", error);
        // Permitir continuar incluso si hay error (offline mode)
        setSelectedLevel(nurseEstimation);
        setIsRevealed(true);
      }
      return; // No cerrar el modal, mostrar comparación
    }

    // 🔓 FASE 2: VALIDATION WITH AI COMPARISON - Guardar decisión final
    const nurseLevel = parseInt(nurseEstimation); // Clasificación original de enfermera
    const finalLevel = parseInt(selectedLevel);   // Decisión final (puede haber cambiado)
    
    // Solo guardar override si la enfermera cambió de opinión después de ver la IA
    const overrideLevel = finalLevel !== nurseLevel ? finalLevel : undefined;

    await onValidate(
      record.id,
      undefined,                       // nurse_esi_level (ya guardado en Fase 1)
      overrideLevel,                   // nurse_override_level (solo si cambió)
      feedback.trim() || undefined,    // feedback
      false                            // no silent (mostrar toast de confirmación)
    );
    
    setIsConfirmed(true);
    setTimeout(() => {
      setIsConfirmed(false);
      onOpenChange(false);
      // Reset blind validation states
      setIsRevealed(false);
      setNurseEstimation("");
    }, 1500);
  };

  const hasOverride = selectedLevel !== record.esi_level.toString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-3">
            {!isRevealed ? (
              <>
                <span className="text-3xl">🔒</span>
                <span>Clasificación Independiente</span>
              </>
            ) : (
              <>
                <span className="text-3xl">🔓</span>
                <span>Validación Final</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-base">
            {!isRevealed ? (
              <span className="font-medium">
                Paso 1: Clasifique al paciente según su criterio clínico profesional
              </span>
            ) : (
              <span className="font-medium">
                Paso 2: Compare con la IA y confirme o ajuste su clasificación
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Información del paciente - siempre visible */}
          <div className="space-y-3 rounded-xl border-2 border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">👤</span>
              <Label className="text-base font-bold text-gray-900">
                Caso #{record.anonymous_code || record.id.slice(0, 8)}
              </Label>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Síntomas reportados:
              </Label>
              <p className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-base leading-relaxed text-gray-900">
                {record.symptoms_text}
              </p>
            </div>
          </div>

          {/* 🔒 FASE 1: Clasificación Ciega (antes de revelar IA) */}
          {!isRevealed && (
            <div className="space-y-5 rounded-xl border-2 border-teal-500 bg-gradient-to-br from-teal-50 to-cyan-50 p-6 shadow-md">
              <div className="flex items-start gap-3 pb-3 border-b border-teal-200">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center">
                  <span className="text-2xl">🔒</span>
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-teal-900 mb-1">
                    Clasificación Ciega - Metodología de Investigación
                  </p>
                  <p className="text-sm text-teal-700 leading-relaxed">
                    Clasifique al paciente usando <strong>solo sus síntomas</strong>, sin ver la sugerencia de la IA. 
                    Esto permite medir la concordancia entre su criterio y el sistema.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="nurse-estimation" className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-lg">🩺</span>
                  ¿Qué nivel ESI asignaría a este paciente?
                </Label>
                <Select value={nurseEstimation} onValueChange={setNurseEstimation}>
                  <SelectTrigger 
                    id="nurse-estimation" 
                    className="h-14 text-base bg-white border-2 border-teal-300 hover:border-teal-400 font-semibold"
                  >
                    <SelectValue placeholder="👉 Seleccione el nivel ESI (1-5)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ESI_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value} className="text-base py-3">
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!nurseEstimation && (
                  <p className="text-xs text-teal-700 italic flex items-center gap-1">
                    <span>💡</span>
                    <span>Seleccione un nivel ESI para continuar</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 🔓 FASE 2: Comparación (después de clasificar) */}
          {isRevealed && (
            <>
              {/* Comparación de clasificaciones */}
              <div className="rounded-xl border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 p-6 shadow-md">
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
                      <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
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
                      <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Clasificación IA
                      </Label>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-indigo-600 mb-1">
                        ESI {record.esi_level}
                      </div>
                      <p className="text-xs text-gray-600">
                        {ESI_LEVELS.find(l => l.value === record.esi_level.toString())?.label.split(' - ')[1]}
                      </p>
                    </div>
                  </div>
                </div>

                {hasOverride ? (
                  <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">⚠️</span>
                    <div>
                      <p className="text-sm font-bold text-amber-900 mb-1">
                        Clasificaciones diferentes
                      </p>
                      <p className="text-xs text-amber-800">
                        Su criterio clínico difiere de la IA. Puede mantener su clasificación o ajustarla.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-green-400 bg-green-50 p-4 flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">✅</span>
                    <div>
                      <p className="text-sm font-bold text-green-900 mb-1">
                        ¡Clasificaciones coinciden!
                      </p>
                      <p className="text-xs text-green-800">
                        Su criterio clínico es consistente con la sugerencia de la IA.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Razonamiento de la IA */}
              <div className="space-y-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧠</span>
                  <Label className="text-base font-bold text-indigo-900">
                    Razonamiento Clínico de la IA:
                  </Label>
                </div>
                <p className="rounded-lg bg-white border border-indigo-200 p-4 text-sm leading-relaxed text-gray-800">
                  {aiData.reasoning || "No disponible"}
                </p>
              </div>

              {/* Ajustar clasificación final */}
              <div className="space-y-3 rounded-xl border-2 border-gray-300 bg-gray-50 p-5">
                <Label htmlFor="esi-level-final" className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">✏️</span>
                  Clasificación Final (puede ajustar si es necesario):
                </Label>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                  <SelectTrigger id="esi-level-final" className="h-14 text-base bg-white border-2 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESI_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value} className="text-base py-3">
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600 italic flex items-center gap-1">
                  <span>💡</span>
                  <span>
                    {selectedLevel === nurseEstimation 
                      ? "Manteniendo su clasificación original" 
                      : "Ha modificado su clasificación después de ver la IA"}
                  </span>
                </p>
              </div>

              {/* Feedback opcional */}
              <div className="space-y-3 rounded-xl border-2 border-gray-300 bg-gray-50 p-5">
                <Label htmlFor="feedback" className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  Comentarios (Opcional):
                </Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Ej: El paciente presentaba signos de... / La IA no consideró... / Coincido porque..."
                  className="min-h-[100px] resize-none border-2 text-base"
                  disabled={isValidating || isConfirmed}
                />
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <span>📝</span>
                  <span>Sus comentarios ayudan a mejorar el sistema y son valiosos para la investigación</span>
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-3 pt-4 border-t-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isValidating || isConfirmed}
            className="h-12 px-6 text-base font-semibold border-2"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={(!isRevealed && !nurseEstimation) || isValidating || isConfirmed}
            className={`h-12 px-8 text-base font-bold min-w-[240px] ${
              !isRevealed 
                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
            }`}
          >
            {isConfirmed ? (
              <>
                <CheckCircle2 className="mr-2 h-6 w-6" />
                ¡Validado Exitosamente!
              </>
            ) : isValidating ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Procesando...
              </>
            ) : !isRevealed ? (
              <>
                <span className="mr-2 text-xl">🔓</span>
                Ver Sugerencia de la IA
              </>
            ) : (
              <>
                <span className="mr-2 text-xl">✅</span>
                Confirmar y Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

