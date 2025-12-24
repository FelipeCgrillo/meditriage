"use client";

import { useEffect, useState, useCallback } from "react";
import { TriageList } from "@/components/dashboard/TriageList";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/lib/hooks/use-toast";
import { Database } from "@/lib/supabase/types";

type TriageRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

export default function NurseDashboardPage() {
  const [records, setRecords] = useState<TriageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clinical_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setRecords(data || []);
    } catch (error) {
      console.error("Error cargando registros:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros. Verifique la conexión a la base de datos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleValidate = async (
    id: string,
    nurseLevel?: number,      // Clasificación independiente de la enfermera (ANTES de ver IA)
    overrideLevel?: number,   // Nivel final si cambia de opinión (DESPUÉS de ver IA)
    feedback?: string,
    silent?: boolean          // No mostrar toast si es guardado intermedio
  ) => {
    try {
      const supabase = createClient();
      const updateData: {
        nurse_validated: boolean;
        nurse_esi_level?: number | null;
        nurse_override_level?: number | null;
        feedback_enfermero?: string | null;
      } = {
        nurse_validated: true,
      };

      // 🔥 CRÍTICO: Guardar clasificación independiente de enfermera (para Kappa)
      if (nurseLevel !== undefined) {
        updateData.nurse_esi_level = nurseLevel;
      }

      // Guardar override solo si la enfermera cambió de opinión después de ver la IA
      if (overrideLevel !== undefined) {
        updateData.nurse_override_level = overrideLevel;
      }

      if (feedback !== undefined) {
        updateData.feedback_enfermero = feedback || null;
      }

      const { error } = await supabase
        .from("clinical_records")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      // Solo mostrar toast si no es guardado silencioso
      if (!silent) {
        toast({
          title: "Validación exitosa",
          description: overrideLevel
            ? `Caso validado con nivel ESI ${overrideLevel}`
            : nurseLevel
              ? `Caso validado con nivel ESI ${nurseLevel}`
              : "Caso validado correctamente",
        });
      }

      // Recargar registros
      await loadRecords();
    } catch (error) {
      console.error("Error validando:", error);
      if (!silent) {
        toast({
          title: "Error",
          description: "No se pudo validar el caso. Intente nuevamente.",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-12">
      <TriageList
        records={records}
        isLoading={isLoading}
        onValidate={handleValidate}
      />
    </div>
  );
}

