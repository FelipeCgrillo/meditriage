# PROYECTO DE TESIS: Automatización del proceso de Triage

**Autor:** Felipe Carrasco  
**Programa:** Magíster en Informática Médica - Universidad de Chile  
**Director de Tesis:** Steffen Härtel  
**Co-Directora:** Sandra de la Fuente  

---

## 1. Resumen
[cite_start]Este proyecto propone el diseño y la validación clínica inicial de una herramienta digital de Triage basada en inteligencia artificial, orientada a ser utilizada directamente por las personas a través de celulares o computadores[cite: 18]. [cite_start]El sistema permitirá analizar síntomas y antecedentes, asignar una categoría ESI y sugerir la acción más adecuada[cite: 19].

**Metodología:**
* [cite_start]Comparación directa de la categorización de la IA con el estándar profesional (enfermería)[cite: 20].
* [cite_start]Uso de métricas como el coeficiente Kappa y sensibilidad[cite: 22].
* [cite_start]Validación en cuatro fases: análisis de flujos, definición de datos (SNOMED CT/LOINC), implementación técnica y validación clínica[cite: 23, 24, 25].

---

## 2. Definición del Problema
[cite_start]A pesar de los avances en la estandarización del Triage en Chile (ESI), no existe un sistema automatizado accesible al paciente para realizar una pre-clasificación desde el hogar[cite: 100].

**Consecuencias actuales:**
* [cite_start]**Sobreutilización:** Pacientes de baja complejidad (ESI 4-5) congestionan urgencias[cite: 113].
* [cite_start]**Subutilización:** Pacientes graves no consultan a tiempo[cite: 114].
* [cite_start]**Falta de integración:** Desconexión entre la orientación remota y el agendamiento real[cite: 115].

---

## 3. Hipótesis y Objetivos

### Hipótesis
[cite_start]Una herramienta digital de Triage automatizado basada en IA puede alcanzar una **concordancia (Kappa) ≥ 0,85** con el Triage profesional, manteniendo una tasa de sub-triage en casos graves (ESI 1-2) **< 5%**[cite: 127].

### Objetivo General
[cite_start]Diseñar y evaluar la concordancia, seguridad clínica y aceptación de una herramienta digital basada en IA para el Triage médico inicial[cite: 129].

### Objetivos Específicos
1.  [cite_start]Analizar y modelar flujos clínicos y criterios médicos[cite: 131].
2.  [cite_start]Definir conjunto mínimo de datos (interoperabilidad)[cite: 132].
3.  [cite_start]Implementar arquitectura funcional (API IA + Frontend)[cite: 133].
4.  [cite_start]Evaluar desempeño (Kappa, Sensibilidad, Aceptación)[cite: 134].

---

## 4. Materiales y Método

### Diseño Técnico
* [cite_start]**Tipo de estudio:** Cuantitativo, descriptivo y analítico[cite: 137].
* **Stack Tecnológico:**
    * *Frontend:* React
    * *Backend:* Flask/Django
    * *IA:* Modelos LLM (GPT-4 / Med-PaLM) + Reglas clínicas
    * *Base de Datos:* PostgreSQL o MongoDB
    * [cite_start]*Interoperabilidad:* Estándar **HL7 FHIR**[cite: 203].

### Población y Muestra
* [cite_start]**Población:** Adultos (≥18 años) con consultas agudas no críticas en Aysén[cite: 143].
* [cite_start]**Muestra:** 200-300 pacientes para asegurar potencia estadística[cite: 157].
* [cite_start]**Criterios de Exclusión:** Casos ESI 1 (críticos), urgencias obstétricas, barreras idiomáticas[cite: 150, 151, 152].

### Flujo del Estudio (BPMN)
El paciente utiliza la herramienta de Auto-Triage en paralelo a la evaluación de la enfermera. [cite_start]Ambos registros se almacenan para comparación ciega[cite: 181, 208].

---

## 5. Resultados Esperados
1.  [cite_start]**Sistema Funcional:** Interfaz paciente + Motor IA + Conectores FHIR[cite: 215].
2.  [cite_start]**Dataset de Validación:** Datos comparativos IA vs. Humano[cite: 216].
3.  [cite_start]**Evaluación de Factibilidad:** Encuestas de satisfacción y usabilidad[cite: 217].
4.  [cite_start]**Informe de Escalamiento:** Análisis legal (Ley 21.668) y técnico para despliegue nacional[cite: 218].

---