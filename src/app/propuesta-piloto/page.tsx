'use client';

import Link from 'next/link';
import {
    Rocket,
    Shield,
    BarChart3,
    Tablet,
    MessageSquare,
    CheckCircle,
    FileText,
    GraduationCap,
    Lock,
    Scale,
    Calendar,
    ExternalLink,
    Mail,
    ChevronRight,
    Quote,
    Heart
} from 'lucide-react';

export default function PropuestaPilotoPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            {/* Hero Section */}
            <header className="relative overflow-hidden">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute top-60 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
                    <div className="absolute bottom-20 right-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000" />
                </div>

                {/* Navigation */}
                <nav className="relative z-10 container mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <Heart className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-white">MediTriage</span>
                        </Link>
                        <div className="hidden md:flex items-center gap-6 text-gray-300">
                            <a href="#beneficios" className="hover:text-white transition-colors">Beneficios</a>
                            <a href="#proceso" className="hover:text-white transition-colors">Proceso</a>
                            <a href="#respaldo" className="hover:text-white transition-colors">Respaldo</a>
                            <Link href="/" className="hover:text-white transition-colors">Volver al Inicio</Link>
                        </div>
                    </div>
                </nav>

                {/* Hero Content */}
                <div className="relative z-10 container mx-auto px-6 py-16 md:py-24">
                    <div className="max-w-4xl mx-auto text-center">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-full px-5 py-2.5 mb-8">
                            <GraduationCap className="w-5 h-5 text-emerald-300" />
                            <span className="text-emerald-200 text-sm font-medium">Piloto Académico - Sin Costo de Implementación</span>
                        </div>

                        {/* Main Title */}
                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                            Lleve la Innovación en Triage a su{' '}
                            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                                Centro de Salud
                            </span>{' '}
                            sin Costo ni Riesgo.
                        </h1>

                        {/* Subtitle */}
                        <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
                            Buscamos un centro partner para validar <strong className="text-white">MediTriage</strong>: la primera herramienta de IA chilena para priorización de urgencias basada en ESI.
                            <span className="block mt-2 text-blue-200">Proyecto de Magíster - Universidad de Chile.</span>
                        </p>

                        {/* CTA Button */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="mailto:felipe.carrasco.gr@ug.uchile.cl?subject=Interés%20en%20Piloto%20MediTriage&body=Estimado%20Felipe,%0A%0AMe%20interesa%20conocer%20más%20sobre%20el%20piloto%20de%20MediTriage%20para%20nuestro%20centro%20de%20salud.%0A%0ANombre%20del%20Centro:%0ACargo:%0ATeléfono%20de%20contacto:%0A%0ASaludos"
                                className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105"
                            >
                                <Calendar className="w-6 h-6" />
                                Agendar Reunión de 10 min
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Gradient divider */}
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent" />
            </header>

            {/* Benefits Section */}
            <section id="beneficios" className="relative py-24 bg-slate-900">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            ¿Por qué participar?
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Beneficios directos para su centro de salud sin inversión ni riesgo operacional
                        </p>
                    </div>

                    {/* Bento Grid Layout */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {/* Card 1 - Implementación Cero Fricción */}
                        <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Rocket className="w-7 h-7 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">
                                Implementación Cero Fricción
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                Plataforma 100% Web. <strong className="text-gray-200">No requiere instalar software</strong> en sus servidores ni integración compleja con su ficha clínica actual.
                            </p>
                        </div>

                        {/* Card 2 - Seguridad Clínica Total */}
                        <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10">
                            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Shield className="w-7 h-7 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">
                                Seguridad Clínica Total
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                Estudio de &apos;sombra&apos; con validación ciega. <strong className="text-gray-200">La enfermera mantiene el 100% de la decisión</strong>. La IA no interactúa clínicamente con el paciente.
                            </p>
                        </div>

                        {/* Card 3 - Reportes de Gestión */}
                        <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 lg:col-span-1 md:col-span-2 lg:row-span-1">
                            <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <BarChart3 className="w-7 h-7 text-cyan-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">
                                Reportes de Gestión Gratuitos
                            </h3>
                            <p className="text-gray-400 leading-relaxed">
                                Reciba un <strong className="text-gray-200">informe detallado de demanda, tiempos de espera y concordancia clínica</strong> al finalizar las 2 semanas de piloto.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="proceso" className="relative py-24 bg-gradient-to-b from-slate-900 to-slate-800">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Cómo funciona el Piloto
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            4 pasos sencillos sin impacto en su flujo de atención actual
                        </p>
                    </div>

                    <div className="max-w-5xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Step 1 */}
                            <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-blue-500/50 transition-all duration-300">
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
                                    1
                                </div>
                                <div className="mt-4">
                                    <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <Tablet className="w-7 h-7 text-blue-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Acceso 100% Web en Sala de Espera
                                    </h3>
                                    <p className="text-gray-400 leading-relaxed">
                                        <strong className="text-gray-200">Funciona desde cualquier dispositivo con navegador</strong> (tablet, PC o celular). Si lo requiere, podemos proveer un dispositivo dedicado sin costo adicional.
                                    </p>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-cyan-500/50 transition-all duration-300">
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/30">
                                    2
                                </div>
                                <div className="mt-4">
                                    <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <MessageSquare className="w-7 h-7 text-cyan-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Paciente ingresa síntomas
                                    </h3>
                                    <p className="text-gray-400 leading-relaxed">
                                        El paciente describe sus síntomas <strong className="text-gray-200">por voz o texto mientras espera</strong>. Proceso voluntario con consentimiento informado.
                                    </p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-emerald-500/50 transition-all duration-300">
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/30">
                                    3
                                </div>
                                <div className="mt-4">
                                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <CheckCircle className="w-7 h-7 text-emerald-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Enfermera valida en 1 clic
                                    </h3>
                                    <p className="text-gray-400 leading-relaxed">
                                        Validación desde nuestra Web App con <strong className="text-gray-200">segundos adicionales al proceso habitual</strong>. Decisión final 100% humana.
                                    </p>
                                </div>
                            </div>

                            {/* Step 4 */}
                            <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-3xl p-8 hover:border-purple-500/50 transition-all duration-300">
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/30">
                                    4
                                </div>
                                <div className="mt-4">
                                    <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <FileText className="w-7 h-7 text-purple-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-3">
                                        Análisis y entrega de resultados
                                    </h3>
                                    <p className="text-gray-400 leading-relaxed">
                                        Al finalizar las 2 semanas, <strong className="text-gray-200">recibirá un reporte ejecutivo</strong> con métricas de gestión y concordancia IA vs. enfermera.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Academic Backing Section */}
            <section id="respaldo" className="relative py-24 bg-slate-800">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Respaldo Académico y Técnico
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Estándares internacionales y el rigor de la investigación universitaria
                        </p>
                    </div>

                    <div className="max-w-5xl mx-auto">
                        {/* Main Academic Card */}
                        <div className="bg-gradient-to-br from-blue-900/30 to-slate-800/50 border border-blue-500/20 rounded-3xl p-8 md:p-10 mb-8">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                                    <GraduationCap className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-white">Proyecto de Tesis</h3>
                                    <p className="text-blue-300">Magíster en Informática Médica - Universidad de Chile</p>
                                </div>
                            </div>
                            <p className="text-gray-300 text-lg leading-relaxed">
                                Este estudio forma parte de una investigación académica formal, con revisión por comité de ética y metodología científica rigurosa para validar la herramienta en un contexto clínico real chileno.
                            </p>
                        </div>

                        {/* Technical Standards Grid */}
                        <div className="grid md:grid-cols-3 gap-6 mb-12">
                            <div className="flex items-start gap-4 bg-slate-700/30 border border-slate-600/50 rounded-2xl p-6">
                                <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-6 h-6 text-cyan-400" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-1">HL7 FHIR</h4>
                                    <p className="text-gray-400 text-sm">Estándares internacionales de interoperabilidad en salud</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 bg-slate-700/30 border border-slate-600/50 rounded-2xl p-6">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Lock className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-1">Encriptación SSL</h4>
                                    <p className="text-gray-400 text-sm">Comunicación segura y datos protegidos en tránsito</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 bg-slate-700/30 border border-slate-600/50 rounded-2xl p-6">
                                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Scale className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-1">Ley 19.628</h4>
                                    <p className="text-gray-400 text-sm">Cumplimiento de la Ley de Protección de Datos de Chile</p>
                                </div>
                            </div>
                        </div>

                        {/* Quote Block */}
                        <div className="relative bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600/50 rounded-3xl p-8 md:p-10">
                            <Quote className="absolute top-6 left-6 w-10 h-10 text-blue-500/30" />
                            <blockquote className="relative z-10 text-center">
                                <p className="text-xl md:text-2xl text-gray-200 italic leading-relaxed mb-6 px-8">
                                    &ldquo;Buscamos optimizar la gestión de la demanda asistencial con evidencia científica, entregando a los directores de CESFAM una herramienta validada y datos accionables.&rdquo;
                                </p>
                                <footer className="text-gray-400">
                                    <span className="font-semibold text-white">Felipe Carrasco Grillo</span>
                                    <span className="block text-sm mt-1">Investigador Principal - Magíster en Informática Médica</span>
                                </footer>
                            </blockquote>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="relative py-24 bg-gradient-to-b from-slate-800 to-slate-900">
                <div className="container mx-auto px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                            ¿Listo para innovar en su CESFAM?
                        </h2>
                        <p className="text-gray-400 mb-10 text-lg">
                            Agende una breve reunión para conocer los detalles del piloto y resolver sus dudas.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <a
                                href="mailto:felipe.carrasco.gr@ug.uchile.cl?subject=Interés%20en%20Piloto%20MediTriage&body=Estimado%20Felipe,%0A%0AMe%20interesa%20conocer%20más%20sobre%20el%20piloto%20de%20MediTriage%20para%20nuestro%20centro%20de%20salud.%0A%0ANombre%20del%20Centro:%0ACargo:%0ATeléfono%20de%20contacto:%0A%0ASaludos"
                                className="group inline-flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold px-10 py-5 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 text-lg"
                            >
                                <Mail className="w-6 h-6" />
                                Contactar al Investigador
                            </a>

                            <Link
                                href="/"
                                className="group inline-flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-semibold px-10 py-5 rounded-2xl transition-all duration-300 hover:scale-105 text-lg"
                            >
                                <ExternalLink className="w-6 h-6" />
                                Ver Demo del Paciente
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 border-t border-slate-800 py-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-emerald-400 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110">
                                <Heart className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-lg font-semibold text-white">MediTriage</span>
                        </Link>

                        <div className="text-gray-500 text-sm text-center md:text-left">
                            Sistema de Auto-Triage con IA para CESFAM
                        </div>

                        <div className="text-gray-500 text-sm text-center md:text-right">
                            <span>Desarrollado por Felipe Carrasco Grillo</span>
                            <span className="block md:inline md:ml-2">• Tesis de Magíster en Informática Médica</span>
                            <span className="block md:inline md:ml-2">• Universidad de Chile • 2025</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
