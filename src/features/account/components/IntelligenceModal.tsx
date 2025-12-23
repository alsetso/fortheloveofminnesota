'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { XMarkIcon, PaperAirplaneIcon, ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/features/auth';
import { AccountService, Account } from '@/features/auth';
import BillingModal from '@/components/modals/BillingModal';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'thinking' | 'task';
  content: string;
  timestamp: Date;
}

interface TaskStatus {
  id: string;
  task: string;
  status: 'pending' | 'processing' | 'complete';
  result?: string;
}

interface LocationData {
  coordinates: { lat: number; lng: number };
  placeName?: string;
  address?: string;
  type?: 'map-click' | 'pin-click' | 'search';
}

interface FeatureMetadata {
  type: string;
  name?: string;
  properties: Record<string, any>;
  showIntelligence?: boolean; // True for homes/houses - requires pro
}

interface IntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationData: LocationData | null;
  pinFeature: FeatureMetadata | null;
}

const MOCK_RESPONSE = "I can help you learn more about this location. What would you like to know?";

export default function IntelligenceModal({ isOpen, onClose, locationData, pinFeature }: IntelligenceModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isStreamingInitial, setIsStreamingInitial] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check if this is a home/house (requires pro for messaging)
  const isHomeLocation = pinFeature?.showIntelligence === true;
  const isPro = userPlan === 'pro';
  const requiresProUpgrade = isHomeLocation && !isPro;

  // Create stable reference for pinFeature to avoid dependency array issues
  const pinFeatureKey = useMemo(() => {
    if (!pinFeature) return null;
    return `${pinFeature.type}-${pinFeature.name || ''}-${Object.keys(pinFeature.properties).length}`;
  }, [pinFeature]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, streamedContent]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Check user plan on mount
  useEffect(() => {
    async function checkPlan() {
      if (user) {
        try {
          const account = await AccountService.getCurrentAccount();
          setUserPlan(account?.plan || 'hobby');
        } catch {
          setUserPlan('hobby');
        }
      } else {
        setUserPlan(null);
      }
    }
    if (isOpen) {
      checkPlan();
    }
  }, [isOpen, user]);

  // Stream initial message when modal opens (simple greeting, not AI-generated)
  useEffect(() => {
    if (!isOpen || !locationData || messages.length > 0) {
      return;
    }

    // Only use Pin Location name if available, otherwise fallback to coordinates
    const locationName = pinFeature?.name || locationData.address || locationData.placeName || `${locationData.coordinates.lat.toFixed(6)}, ${locationData.coordinates.lng.toFixed(6)}`;
    const fullMessage = `I have information about ${locationName}. How can I help you?`;

    // Show loading dots first
    setIsStreamingInitial(true);
    setStreamedContent('');

    // After a brief delay, start streaming
    const startStreaming = setTimeout(() => {
      let currentIndex = 0;
      const streamInterval = 30; // milliseconds per character

      const streamNextChar = () => {
        if (currentIndex < fullMessage.length) {
          setStreamedContent(fullMessage.slice(0, currentIndex + 1));
          currentIndex++;
          streamingTimeoutRef.current = setTimeout(streamNextChar, streamInterval);
        } else {
          // Streaming complete, add to messages
          const initialMessage: Message = {
            id: 'initial',
            role: 'assistant',
            content: fullMessage,
            timestamp: new Date(),
          };
          setMessages([initialMessage]);
          setIsStreamingInitial(false);
          setStreamedContent('');
        }
      };

      streamNextChar();
    }, 800); // Show loading dots for 800ms

    return () => {
      clearTimeout(startStreaming);
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, locationData, messages.length, pinFeatureKey]);

  // Reset messages when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInputValue('');
      setIsStreamingInitial(false);
      setStreamedContent('');
      setActiveTasks([]);
      setUserPlan(null);
      setShowUpgradeModal(false);
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isThinking) return;
    
    // Block messages for home locations without pro
    if (requiresProUpgrade) return;

    const userMessageText = inputValue.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsThinking(true);

    // Initialize background tasks
    const tasks: TaskStatus[] = [
      { id: '1', task: 'Check user status', status: 'pending' },
      { id: '2', task: 'Check plan', status: 'pending' },
      { id: '3', task: 'Read message', status: 'pending' },
      { id: '4', task: 'Write response', status: 'pending' },
    ];
    setActiveTasks(tasks);

    // Task 1: Check user status
    await new Promise(resolve => setTimeout(resolve, 300));
    setActiveTasks(prev => prev.map(t => 
      t.id === '1' ? { ...t, status: 'processing' } : t
    ));
    await new Promise(resolve => setTimeout(resolve, 400));
    const userStatus = user ? 'user' : 'guest';
    setActiveTasks(prev => prev.map(t => 
      t.id === '1' ? { ...t, status: 'complete', result: userStatus } : t
    ));

    // Task 2: Check plan (only if user)
    if (user) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setActiveTasks(prev => prev.map(t => 
        t.id === '2' ? { ...t, status: 'processing' } : t
      ));
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const account: Account | null = await AccountService.getCurrentAccount();
        const plan = account?.plan || 'hobby';
        setActiveTasks(prev => prev.map(t => 
          t.id === '2' ? { ...t, status: 'complete', result: plan } : t
        ));
      } catch (error) {
        setActiveTasks(prev => prev.map(t => 
          t.id === '2' ? { ...t, status: 'complete', result: 'hobby' } : t
        ));
      }
    } else {
      // Skip plan check for guests
      setActiveTasks(prev => prev.map(t => 
        t.id === '2' ? { ...t, status: 'complete', result: 'N/A (guest)' } : t
      ));
    }

    // Task 3: Read message
    await new Promise(resolve => setTimeout(resolve, 200));
    setActiveTasks(prev => prev.map(t => 
      t.id === '3' ? { ...t, status: 'processing' } : t
    ));
    await new Promise(resolve => setTimeout(resolve, 600));
    setActiveTasks(prev => prev.map(t => 
      t.id === '3' ? { ...t, status: 'complete', result: 'Message analyzed' } : t
    ));

    // Task 4: Write response
    await new Promise(resolve => setTimeout(resolve, 200));
    setActiveTasks(prev => prev.map(t => 
      t.id === '4' ? { ...t, status: 'processing' } : t
    ));

    // Call OpenAI API
    try {
      const locationName = pinFeature?.name || locationData?.address || locationData?.placeName || null;
      const response = await fetch('/api/intelligence/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          locationName,
          pinFeature: pinFeature ? {
            type: pinFeature.type,
            name: pinFeature.name,
            properties: pinFeature.properties,
          } : null,
        }),
      });

      if (!response.ok) {
        // Better error handling - check content type first
        let errorData: any = {};
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await response.json();
          } catch (e) {
            const text = await response.text();
            errorData = { message: text, status: response.status };
          }
        } else {
          const text = await response.text();
          errorData = { message: text, status: response.status, statusText: response.statusText };
        }
        
        console.error('API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        
        throw new Error(errorData.error || errorData.message || `Failed to get AI response (${response.status})`);
      }

      const data = await response.json();
      const assistantContent = data.message || MOCK_RESPONSE;

      // Clear tasks and show response
      setActiveTasks([]);
      setIsThinking(false);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error calling intelligence API:', error);
      
      // Clear tasks and show fallback response
      setActiveTasks([]);
      setIsThinking(false);

      const errorMessage = error instanceof Error ? error.message : 'I apologize, but I encountered an error. Please try again.';
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal - Overlays left sidebar, slides in from left */}
      <div
        className={`
          fixed left-0 top-0 bottom-0 z-[51] bg-white border-r border-gray-200 flex flex-col shadow-xl
          w-[80vw] lg:w-80
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Back to sidebar"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <SparklesIcon className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Intelligence</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Location Context */}
        {locationData && (
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="text-xs text-gray-600">
              <span className="font-medium text-gray-900">Location:</span>{' '}
              {locationData.address || locationData.placeName || `${locationData.coordinates.lat.toFixed(6)}, ${locationData.coordinates.lng.toFixed(6)}`}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {locationData.coordinates.lat.toFixed(6)}, {locationData.coordinates.lng.toFixed(6)}
            </div>
            {pinFeature && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-900 mb-1">
                  Pin Location: {pinFeature.name || pinFeature.type}
                </div>
                {Object.keys(pinFeature.properties).length > 0 && (
                  <div className="space-y-0.5">
                    {Object.entries(pinFeature.properties).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">{key}:</span> {String(value)}
                      </div>
                    ))}
                    {Object.keys(pinFeature.properties).length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{Object.keys(pinFeature.properties).length - 3} more properties
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Messages Feed */}
        <div 
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ minHeight: 0 }}
        >
          {messages.length === 0 && !isStreamingInitial ? (
            <div className="flex flex-col items-center justify-center h-full">
              <SparklesIcon className="w-8 h-8 text-gray-400 mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Location Intelligence</h3>
              <p className="text-xs text-gray-500 text-center max-w-xs">
                Ask questions about this location to get insights and information.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Show loading dots or streaming content */}
              {isStreamingInitial && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-md px-3 py-2">
                    {streamedContent ? (
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{streamedContent}</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Show completed messages */}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-md px-3 py-2 ${
                      message.role === 'user'
                        ? 'bg-gray-200 text-gray-900'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {/* Show background intelligence tasks */}
              {activeTasks.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        {task.status === 'pending' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        )}
                        {task.status === 'processing' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                        )}
                        {task.status === 'complete' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                        )}
                      </div>
                      <span className="flex-1">
                        {task.task}
                        {task.status === 'complete' && task.result && (
                          <span className="text-gray-400 ml-1">({task.result})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {isThinking && activeTasks.length === 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 px-4 py-3 flex-shrink-0">
          {requiresProUpgrade ? (
            // Pro upgrade prompt for home locations
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <SparklesIcon className="w-4 h-4 text-indigo-500" />
                <span>Property intelligence requires Pro</span>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              >
                Upgrade to Pro
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about this location..."
                disabled={isThinking}
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isThinking}
                className="p-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Billing & Upgrade Modal - overlays the intelligence sidebar */}
      <BillingModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="Property Intelligence"
        overlay="sidebar"
      />
    </>
  );
}



