# CONTEXTO DEL PROYECTO: Automatización de Triage con IA

## 1. Ficha del Proyecto
* **Título:** Automatización del proceso de Triage mediante herramienta digital basada en IA.
* **Institución:** Universidad de Chile - Facultad de Medicina.
* **Propósito:** Tesis de Magíster en Informática Médica.
* **Autor:** Felipe Carrasco.

---

## 2. Definición del Problema
[cite_start]Actualmente, no existe un sistema automatizado y accesible que permita realizar una pre-clasificación de urgencia desde el hogar[cite: 17]. Esto provoca:
* [cite_start]**Saturación de Urgencias:** Pacientes con baja complejidad (ESI 4-5) acuden innecesariamente a hospitales de alta complejidad[cite: 104].
* [cite_start]**Riesgo Clínico:** Pacientes graves (ESI 1-2) retrasan su consulta por subestimar síntomas (Sub-triage)[cite: 107].
* [cite_start]**Falta de Trazabilidad:** Los datos del triage presencial muchas veces no son reutilizables ni estructurados[cite: 117].

---

## 3. Solución Propuesta
Desarrollo de una **Aplicación Web Progresiva (PWA)** que permite al paciente autoevaluarse.
* **Input:** Síntomas y antecedentes ingresados por el paciente.
* **Proceso:** Análisis mediante IA (LLM + Reglas Clínicas) para asignar categoría ESI.
* [cite_start]**Output:** Recomendación de acción (Urgencia, APS, Domicilio) y vinculación con agenda[cite: 19].

---

## 4. Requerimientos Técnicos y Arquitectura

### [cite_start]4.1 Stack Tecnológico [cite: 201-203]
* **Frontend:** React (Web/Móvil) - Enfocado en usabilidad rápida.
* **Backend:** Python (Flask/Django) - Para lógica de negocio e integraciones.
* **IA Core:** Modelos de Lenguaje (GPT-4 / Med-PaLM) vía API.
* **Base de Datos:** PostgreSQL (Relacional) o MongoDB.
* **Interoperabilidad:** **Estricto cumplimiento de HL7 FHIR**.

### [cite_start]4.2 Integración y Flujo de Datos [cite: 178-182]
1.  **Ingreso:** Paciente inicia el flujo en la app y firma consentimiento.
2.  **Triage Paralelo (Estudio):**
    * *Humano:* Enfermero realiza ESI estándar.
    * *Sistema:* App captura síntomas -> IA procesa -> Asigna ESI preliminar.
3.  **Comparación:** Ambos resultados se almacenan para calcular concordancia (Kappa).

### 4.3 Estándares de Datos
* [cite_start]**Recursos FHIR:** Usar `Appointment`, `Slot`, `ServiceRequest` y `Observation`[cite: 92].
* [cite_start]**Terminología:** SNOMED CT para síntomas y hallazgos clínicos[cite: 24].

---

## 5. Reglas de Negocio y Seguridad Clínica

### [cite_start]5.1 Criterios de Exclusión (Hard Stops) [cite: 150-153]
El sistema **NO** debe procesar (debe derivar inmediatamente a urgencia presencial):
* Casos críticos evidentes (Paro, asfixia, sangrado masivo - ESI 1).
* Urgencias obstétricas (Embarazo).
* Pacientes sin capacidad de interactuar (Conciencia alterada).

### [cite_start]5.2 Métricas de Validación [cite: 187-188]
* **Objetivo de Concordancia:** Índice Kappa ≥ 0.85 con respecto al enfermero.
* **Seguridad Crítica:** Tasa de Sub-triage < 5% en casos ESI 1 y 2. (Es preferible sobreestimar la gravedad que subestimarla).

---

## 6. Consideraciones Éticas y Legales
* [cite_start]**Protección de Datos:** Cumplimiento estricto de la Ley 19.628 y Ley 20.584 [cite: 196-197].
* **Anonimización:** Los datos enviados a la API de IA deben estar despojados de identificadores personales (PII).
* **Transparencia:** El usuario debe saber que está siendo evaluado por una IA y que es una recomendación, no un diagnóstico médico final.