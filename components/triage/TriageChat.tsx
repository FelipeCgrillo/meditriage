"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Bot, 
  Loader2, 
  Mic, 
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/lib/hooks/use-toast";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  options?: string[];
  timestamp: Date;
}

export interface DemographicData {
  gender: string | null;
  ageGroup: string | null;
}

interface TriageChatProps {
  onComplete: (messages: Message[], finalSymptoms: string, demographics: DemographicData) => Promise<void>;
}

const MIN_INPUT_LENGTH = 3;
const MAX_TURNS = 15; // Safety limit

type ConsentStep = 'welcome' | 'consent' | 'gender' | 'age' | 'completed';

export function TriageChat({ onComplete }: TriageChatProps) {
  // Consent flow state
  const [consentStep, setConsentStep] = useState<ConsentStep>('welcome');
  const [hasConsented, setHasConsented] = useState(false);
  const [demographics, setDemographics] = useState<DemographicData>({
    gender: null,
    ageGroup: null
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hola. Soy el asistente virtual del CESFAM. Este sistema usa IA para pre-clasificar su urgencia bajo supervisión de enfermería.\n\n¿Autoriza el uso de sus datos para la evaluación?',
      options: ['Sí, autorizo', 'No autorizo'],
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Voice input integration
  const {
    isListening,
    transcript,
    isSupported: isVoiceSupported,
    startListening,
    stopListening,
    resetTranscript,
    error: voiceError
  } = useVoiceInput();

  // Update input when voice transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(prev => prev + transcript);
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Show toast for voice errors
  useEffect(() => {
    if (voiceError) {
      toast({
        title: "Error de Voz",
        description: voiceError,
        variant: "destructive",
      });
    }
  }, [voiceError, toast]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleConsentResponse = async (response: string) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    
    if (response === 'Sí, autorizo') {
      setHasConsented(true);
      setConsentStep('gender');
      addMessage({
        role: 'assistant',
        content: 'Para comenzar, indique su género biológico:',
        options: ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir']
      });
    } else {
      addMessage({
        role: 'assistant',
        content: 'Sin su autorización no se puede proceder con la evaluación.\n\nSi cambia de opinión, recargue la página.'
      });
    }
    setIsTyping(false);
  };

  const handleGenderResponse = async (gender: string) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    
    const genderMap: { [key: string]: string } = {
      'Masculino': 'M',
      'Femenino': 'F',
      'Otro': 'Other',
      'Prefiero no decir': 'Prefer not to say'
    };
    
    setDemographics(prev => ({ ...prev, gender: genderMap[gender] || null }));
    setConsentStep('age');
    
    addMessage({
      role: 'assistant',
      content: 'Indique su grupo etario:',
      options: ['Pediátrico (0-17 años)', 'Adulto (18-64 años)', 'Geriátrico (65+ años)', 'Prefiero no decir']
    });
    setIsTyping(false);
  };

  const handleAgeResponse = async (ageGroup: string) => {
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 450));
    
    const ageMap: { [key: string]: string } = {
      'Pediátrico (0-17 años)': 'Pediatric',
      'Adulto (18-64 años)': 'Adult',
      'Geriátrico (65+ años)': 'Geriatric',
      'Prefiero no decir': null as any
    };
    
    setDemographics(prev => ({ ...prev, ageGroup: ageMap[ageGroup] || null }));
    setConsentStep('completed');
    
    addMessage({
      role: 'assistant',
      content: '¿Cuál es el motivo principal de su consulta? (Describa sus síntomas brevemente).'
      // Sin opciones - permitir escritura libre
    });
    setIsTyping(false);
  };

  const callTriageAPI = async (userMessage: string) => {
    try {
      setIsTyping(true);
      
      // Add user message first
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      };
      
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      // Call API with conversation history
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symptoms: userMessage,
          messages: updatedMessages
        }),
      });

      if (!response.ok) {
        throw new Error("Error al procesar la respuesta");
      }

      const data = await response.json();

      // Small delay to simulate typing
      await new Promise(resolve => setTimeout(resolve, 400));

      if (data.success && data.data) {
        const aiResponse = data.data;

        if (aiResponse.status === 'needs_info') {
          // Continue conversation with follow-up question
          addMessage({
            role: 'assistant',
            content: aiResponse.follow_up_question || '¿Puede proporcionar más detalles?',
            options: aiResponse.suggested_options
          });
        } else if (aiResponse.status === 'completed') {
          // Classification complete - finalize
          const symptomsSummary = updatedMessages
            .filter(m => m.role === 'user')
            .map(m => m.content)
            .join(' | ');
          
          await onComplete(updatedMessages, symptomsSummary, demographics);
        }
      } else if (data.fallback) {
        // Fallback mode - complete immediately
        toast({
          title: "Modo de respaldo activado",
          description: "La clasificación será manual.",
          variant: "default",
        });
        
        const symptomsSummary = updatedMessages
          .filter(m => m.role === 'user')
          .map(m => m.content)
          .join(' | ');
        
        await onComplete(updatedMessages, symptomsSummary, demographics);
      } else {
        throw new Error("Respuesta inválida del servidor");
      }

    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Ocurrió un error al procesar su mensaje. Por favor, intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = input.trim();

    if (trimmedInput.length < MIN_INPUT_LENGTH) {
      toast({
        title: "Mensaje muy corto",
        description: `Por favor, escriba al menos ${MIN_INPUT_LENGTH} caracteres.`,
        variant: "destructive",
      });
      return;
    }

    if (isProcessing || isTyping) return;

    // Don't allow text input during consent flow - only options
    if (consentStep !== 'completed') {
      toast({
        title: "Por favor, selecciona una opción",
        description: "Usa los botones para responder.",
        variant: "default",
      });
      return;
    }

    // Safety check for too many turns
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    if (userMessageCount >= MAX_TURNS) {
      toast({
        title: "Conversación muy extensa",
        description: "Finalizando evaluación...",
      });
      
      const symptomsSummary = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join(' | ');
      
      await onComplete(messages, symptomsSummary, demographics);
      return;
    }

    setIsProcessing(true);
    setInput("");
    await callTriageAPI(trimmedInput);
  };

  const handleOptionClick = async (option: string) => {
    if (isProcessing || isTyping) return;

    setIsProcessing(true);
    
    // Add user's choice as a message
    addMessage({
      role: 'user',
      content: option
    });

    // Handle based on consent flow step
    if (consentStep === 'welcome') {
      await handleConsentResponse(option);
      setIsProcessing(false);
    } else if (consentStep === 'gender') {
      await handleGenderResponse(option);
      setIsProcessing(false);
    } else if (consentStep === 'age') {
      await handleAgeResponse(option);
      setIsProcessing(false);
    } else if (consentStep === 'completed') {
      // Normal triage flow
      await callTriageAPI(option);
    }
  };

  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const showManualFinish = userMessageCount >= 5;

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-screen md:h-[calc(100vh-4rem)] w-full md:max-w-5xl md:mx-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/80 via-white to-white md:shadow-2xl md:rounded-t-2xl overflow-hidden">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm h-16 md:h-18 flex items-center px-4 md:px-6 flex-shrink-0 border-b border-indigo-100/30">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
            <Bot className="h-5 w-5 md:h-6 md:w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-gray-900 font-bold text-base md:text-lg tracking-tight">Chat de Triage ESI</h1>
            <p className="text-gray-500 text-xs md:text-sm font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 bg-teal-400 rounded-full"></span>
              <span>Asistente médico virtual</span>
            </p>
          </div>
        </div>
      </header>
      
      {/* Messages Area - Light background */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full px-3 md:px-6 py-4 md:py-6" ref={scrollAreaRef}>
          <div className="space-y-4 md:space-y-5 max-w-4xl mx-auto">
            {messages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onOptionClick={handleOptionClick}
                disabled={isProcessing || isTyping}
              />
            ))}
            
            {isTyping && <TypingIndicator />}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Floating Input Footer - Modern glow design */}
      <div className="bg-transparent p-3 md:p-5 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 md:gap-3 max-w-4xl mx-auto bg-white rounded-full shadow-xl shadow-indigo-100/50 px-2 md:px-3 py-2 border border-indigo-50">
          {/* Voice Input Button */}
          {isVoiceSupported && consentStep === 'completed' && (
            <button
              type="button"
              onClick={handleVoiceToggle}
              disabled={isProcessing || isTyping}
              className={cn(
                "flex items-center justify-center flex-shrink-0 rounded-full transition-all duration-200 h-10 w-10 md:h-11 md:w-11",
                "bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed",
                isListening && "bg-red-500 hover:bg-red-600 animate-pulse"
              )}
              title={isListening ? "Detener grabación" : "Grabar mensaje de voz"}
            >
              <Mic className={cn("h-5 w-5 md:h-5 md:w-5", isListening ? "text-white" : "text-indigo-600")} />
            </button>
          )}
          
          {/* Text Input - Modern design */}
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={consentStep === 'completed' ? "Describe tus síntomas aquí..." : "Selecciona una opción arriba..."}
              className={cn(
                "w-full rounded-full border-0 bg-gray-50 px-4 md:px-5 py-2.5 md:py-3 text-sm md:text-base",
                "focus:bg-white focus:ring-2 focus:ring-indigo-500/20",
                "disabled:bg-gray-100 disabled:text-gray-400"
              )}
              disabled={isProcessing || isTyping || consentStep !== 'completed'}
              maxLength={500}
            />
            {input.length > 0 && consentStep === 'completed' && (
              <span className="absolute right-3 bottom-2 text-xs text-slate-400">
                {input.length}/500
              </span>
            )}
          </div>
          
          {/* Send Button - Joyful gradient */}
          <button 
            type="submit"
            className={cn(
              "flex items-center justify-center flex-shrink-0 rounded-full h-10 w-10 md:h-11 md:w-11 transition-all",
              "bg-gradient-to-r from-violet-600 to-indigo-600 hover:shadow-lg hover:shadow-indigo-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            disabled={isProcessing || isTyping || input.trim().length < MIN_INPUT_LENGTH || consentStep !== 'completed'}
            title="Enviar mensaje"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 md:h-5 md:w-5 animate-spin text-white" />
            ) : (
              <Send className="h-5 w-5 md:h-5 md:w-5 text-white" />
            )}
          </button>
          
          {/* Manual Finish Button - Modern style */}
          {showManualFinish && !isProcessing && consentStep === 'completed' && (
            <Button
              type="button"
              variant="secondary"
              className="flex-shrink-0 rounded-full text-xs md:text-sm px-4 md:px-5 h-10 md:h-11 font-medium bg-white ring-1 ring-slate-100 hover:ring-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              onClick={async () => {
                const symptomsSummary = messages
                  .filter(m => m.role === 'user')
                  .map(m => m.content)
                  .join(' | ');
                await onComplete(messages, symptomsSummary, demographics);
              }}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Finalizar
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

// Subcomponent: Message Bubble (WhatsApp Style)
interface MessageBubbleProps {
  message: Message;
  onOptionClick: (option: string) => void;
  disabled?: boolean;
}

function MessageBubble({ message, onOptionClick, disabled }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  // Parse message content - Minimal version (no icons)
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    
    return lines.map((line, idx) => {
      // Remove icon prefixes (like CHECK|, ALERT|, INFO|, etc.)
      const cleanedLine = line.replace(/^[A-Z]+\|/, '');
      
      // Regular line - just text
      return cleanedLine ? <div key={idx} className="mb-1.5">{cleanedLine}</div> : <div key={idx} className="h-2" />;
    });
  };
  
  return (
    <div className={cn(
      "flex animate-in fade-in-50 slide-in-from-bottom-2 duration-500",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "flex flex-col gap-2 md:gap-2.5 max-w-[85%] sm:max-w-[80%] md:max-w-[70%]",
        isUser && "items-end"
      )}>
        {/* Message Bubble - Modern joyful design */}
        <div className={cn(
          "rounded-[24px] px-4 py-3 md:px-5 md:py-3.5",
          isUser 
            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-200 rounded-br-sm" 
            : "bg-white text-slate-700 shadow-sm rounded-bl-sm"
        )}>
          <div className="text-sm md:text-base leading-relaxed">
            {renderMessageContent(message.content)}
          </div>
          {/* Timestamp INSIDE bubble */}
          <span className={cn(
            "text-[10px] md:text-xs block text-right mt-2 font-light",
            isUser ? "text-white/70" : "text-slate-400"
          )}>
            {message.timestamp.toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        
        {/* Quick Reply Options - Modern interactive chips */}
        {message.options && message.options.length > 0 && !isUser && (
          <div className="flex flex-wrap gap-2 md:gap-2.5 animate-in fade-in-50 slide-in-from-bottom-1 duration-700">
            {message.options.map((option, idx) => {
              return (
                <button
                  key={idx}
                  onClick={() => !disabled && onOptionClick(option)}
                  disabled={disabled}
                  className={cn(
                    "group relative cursor-pointer rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-100",
                    "hover:ring-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 hover:-translate-y-0.5",
                    "transition-all duration-200 text-xs md:text-sm py-2.5 md:py-3 px-4 md:px-5 font-medium",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:ring-slate-100 disabled:hover:translate-y-0",
                    "animate-in fade-in-50 zoom-in-95 duration-300"
                  )}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent: Typing Indicator - Modern hopeful style
function TypingIndicator() {
  return (
    <div className="flex justify-start animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-3 bg-white rounded-[24px] rounded-bl-sm px-4 md:px-5 py-3 md:py-3.5 shadow-sm">
        <span className="text-xs md:text-sm text-slate-600 font-medium">Escribiendo</span>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

