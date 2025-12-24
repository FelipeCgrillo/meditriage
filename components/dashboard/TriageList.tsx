"use client";

import { TriageCard } from "./TriageCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { Database } from "@/lib/supabase/types";
import { extractAIResponse } from "@/lib/utils/triage";

type TriageRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

interface TriageListProps {
  records: TriageRecord[];
  isLoading?: boolean;
  onValidate: (
    id: string,
    nurseLevel?: number,
    overrideLevel?: number,
    feedback?: string,
    silent?: boolean
  ) => Promise<void>;
}

export function TriageList({ records, isLoading, onValidate }: TriageListProps) {
  const pendingCount = records.filter((r) => !r.nurse_validated).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-2">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
          <CardTitle className="mb-2">No hay casos pendientes</CardTitle>
          <CardDescription>Todos los casos han sido validados</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Dashboard de Enfermería</h2>
            <p className="mt-2 text-muted-foreground">
              Casos pendientes de validación
            </p>
          </div>
          <Badge variant="secondary" className="px-4 py-2 text-base">
            {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <div className="space-y-6">
        {records
          .filter((record) => !record.nurse_validated)
          .sort((a, b) => {
            // Ordenar por ESI (más urgente primero) y luego por fecha
            if (a.esi_level !== b.esi_level) {
              return a.esi_level - b.esi_level;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
          .map((record) => {
            const aiData = extractAIResponse(record);
            return (
              <TriageCard
                key={record.id}
                id={record.id}
                anonymousCode={record.anonymous_code}
                symptoms={record.symptoms_text}
                esiLevel={record.esi_level}
                aiReasoning={aiData.reasoning}
                criticalSigns={aiData.criticalSigns}
                suggestedSpecialty={aiData.suggestedSpecialty}
                createdAt={record.created_at}
                onValidate={onValidate}
              />
            );
          })}
      </div>
    </>
  );
}

