'use client';

import Link from 'next/link';
import { Activity, Shield, Users, ArrowRight, CheckCircle2, Heart } from 'lucide-react';

export default function Home() {
    return (
        <main className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
            {/* Header / Nav */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-medical-primary rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-medical-primary to-blue-600">
                        MediTriage
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
                    <a href="#solucion" className="hover:text-medical-primary transition-colors">Solución</a>
                    <a href="#ventajas" className="hover:text-medical-primary transition-colors">Ventajas</a>
                    <Link href="/login/nurse" className="px-5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 transition-all">
                        Acceso Profesional
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-30 pointer-events-none">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400 rounded-full blur-[120px]" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-300 rounded-full blur-[120px]" />
                </div>

                <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                            </span>
                            MediTriage IA v2.0
                        </div>
                        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight text-slate-900">
                            El futuro del <span className="text-medical-primary italic">Triaje Digital</span> impulsado por IA.
                        </h1>
                        <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
                            Optimización de la atención de urgencia mediante pre-clasificación inteligente. Rápido, seguro y diseñado para la Red de Salud Pública.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link href="/patient/chat" className="group flex items-center justify-center gap-2 px-8 py-4 bg-medical-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all hover:scale-[1.02]">
                                Iniciar Auto-Evaluación
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link href="/login/nurse" className="flex items-center justify-center px-8 py-4 bg-white text-slate-700 border-2 border-slate-100 rounded-2xl font-bold text-lg hover:border-slate-300 transition-all">
                                Acceso Enfermería
                            </Link>
                        </div>
                        <div className="flex items-center gap-6 pt-4">
                            <div className="flex -space-x-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                                        <Users className="w-5 h-5 text-slate-400" />
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm font-medium text-slate-500">
                                <span className="text-slate-900 font-bold">+500</span> pacientes evaluados con éxito
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="relative bg-white/40 backdrop-blur-3xl rounded-[40px] border border-white/40 p-2 shadow-2xl ring-1 ring-slate-900/5 rotate-3">
                            <img
                                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800&h=1000"
                                alt="Modern Healthcare"
                                className="rounded-[32px] shadow-sm grayscale-[0.2]"
                            />
                            {/* Floating AI Card */}
                            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 max-w-[240px] -rotate-3 animate-bounce-slow">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="font-bold text-slate-800">IA Clínica</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-snug">
                                    Análisis en tiempo real basado en protocolo ESI internacional.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Preview */}
            <section id="solucion" className="py-24 bg-white relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-blue-600 font-bold tracking-widest uppercase text-sm mb-4">El Problema</h2>
                        <h3 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
                            Reduciendo la congestión clínica mediante tecnología.
                        </h3>
                        <p className="text-lg text-slate-600">
                            MediTriage actúa como el primer punto de contacto digital, detectando casos críticos al instante y guiando a los pacientes no críticos al nivel de atención adecuado.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="p-10 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl transition-all hover:-translate-y-1">
                            <Shield className="w-12 h-12 text-medical-primary mb-6" />
                            <h4 className="text-xl font-bold mb-4">Validación Ciega</h4>
                            <p className="text-slate-600 leading-relaxed">
                                Protocolo riguroso de investigación donde el enfermero valida el caso sin sesgos previos del IA.
                            </p>
                        </div>
                        <div className="p-10 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl transition-all hover:-translate-y-1">
                            <Activity className="w-12 h-12 text-emerald-500 mb-6" />
                            <h4 className="text-xl font-bold mb-4">Realtime Dashboard</h4>
                            <p className="text-slate-600 leading-relaxed">
                                Visualización inmediata de nuevos ingresos para el personal de salud mediante Supabase Realtime.
                            </p>
                        </div>
                        <div className="p-10 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl transition-all hover:-translate-y-1">
                            <Heart className="w-12 h-12 text-pink-500 mb-6" />
                            <h4 className="text-xl font-bold mb-4">Enfoque Humano</h4>
                            <p className="text-slate-600 leading-relaxed">
                                La IA asiste, no reemplaza. El criterio clínico del profesional siempre tiene la última palabra.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Institutional Footer */}
            <footer className="bg-slate-900 text-slate-400 py-16 px-6">
                <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center border-b border-slate-800 pb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <Activity className="w-8 h-8 text-medical-primary" />
                            <span className="text-2xl font-bold text-white">MediTriage</span>
                        </div>
                        <p className="max-w-md">
                            Proyecto de investigación clínica desarrollado por Felipe Carrasco para la Facultad de Medicina, Universidad de Chile.
                        </p>
                    </div>
                    <div className="flex flex-col md:items-end gap-4">
                        <p className="text-sm font-bold text-white">MAGÍSTER EN INFORMÁTICA MÉDICA</p>
                        <p className="text-xs uppercase tracking-widest text-slate-500">Tesis de Postgrado 2025</p>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium">
                    <p>© 2025 MediTriage IA. Todos los derechos reservados.</p>
                    <div className="flex gap-8">
                        <a href="#" className="hover:text-white transition-colors">Normativa HIPAA</a>
                        <a href="#" className="hover:text-white transition-colors">Privacidad Clínica</a>
                        <a href="#" className="hover:text-white transition-colors">Ley 19.628 (CL)</a>
                    </div>
                </div>
            </footer>

            <style jsx global>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0) rotate(-3deg); }
                    50% { transform: translateY(-10px) rotate(-3deg); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 4s ease-in-out infinite;
                }
            `}</style>
        </main>
    );
}
