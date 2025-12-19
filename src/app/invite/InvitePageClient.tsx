'use client';

import React, { useState, useCallback } from 'react';
import SimplePageLayout from '@/components/SimplePageLayout';
import {
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { usePageView } from '@/hooks/usePageView';

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export default function InvitePageClient() {
  usePageView();

  const [isFlipped, setIsFlipped] = useState(false);
  
  // Front side text elements
  const [frontTexts, setFrontTexts] = useState<TextElement[]>([
    {
      id: '1',
      text: 'Greetings from Minnesota!',
      x: 50,
      y: 40,
      fontSize: 28,
      fontFamily: 'Libre Baskerville',
      color: '#1f2937',
    },
  ]);
  
  // Back side state
  const [message, setMessage] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [senderName, setSenderName] = useState('');
  
  // Editing state
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
    setEditingTextId(null);
  }, []);

  const handleAddText = useCallback(() => {
    const newText: TextElement = {
      id: Date.now().toString(),
      text: 'New Text',
      x: 50,
      y: 50 + (frontTexts.length * 10),
      fontSize: 20,
      fontFamily: 'Inter',
      color: '#1f2937',
    };
    setFrontTexts(prev => [...prev, newText]);
    setEditingTextId(newText.id);
  }, [frontTexts.length]);

  const handleUpdateText = useCallback((id: string, updates: Partial<TextElement>) => {
    setFrontTexts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const handleDeleteText = useCallback((id: string) => {
    setFrontTexts(prev => prev.filter(t => t.id !== id));
    setEditingTextId(null);
  }, []);

  const editingText = frontTexts.find(t => t.id === editingTextId);

  return (
    <SimplePageLayout 
      containerMaxWidth="full" 
      backgroundColor="bg-[#f4f2ef]" 
      contentPadding="p-4 md:p-6 lg:p-8"
    >
      <div className="min-h-[calc(100vh-160px)] flex flex-col">
        {/* Header */}
        <div className="text-center mb-4 md:mb-6">
          <h1 className="text-sm md:text-base font-semibold text-gray-900">Edit your Invite</h1>
        </div>

        {/* Postcard Container - Flex to fill available space */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          <div className="w-full max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] 2xl:max-w-[50vw]">
            <div 
              className="postcard-scene-responsive"
              style={{ perspective: '1500px' }}
            >
              <div
                className={`postcard-card ${isFlipped ? 'is-flipped' : ''}`}
              >
                {/* Front Side */}
                <div className="postcard-face postcard-front bg-[#faf8f4]">
                  {/* Text Elements */}
                  {frontTexts.map(text => (
                    <div
                      key={text.id}
                      className={`absolute cursor-pointer select-none transition-all ${
                        editingTextId === text.id ? 'ring-2 ring-blue-500 ring-offset-2 rounded' : ''
                      }`}
                      style={{
                        left: `${text.x}%`,
                        top: `${text.y}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `clamp(${text.fontSize * 0.6}px, ${text.fontSize * 0.04}vw + ${text.fontSize * 0.5}px, ${text.fontSize * 1.5}px)`,
                        fontFamily: text.fontFamily,
                        color: text.color,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTextId(editingTextId === text.id ? null : text.id);
                      }}
                    >
                      {editingTextId === text.id ? (
                        <input
                          type="text"
                          value={text.text}
                          onChange={(e) => handleUpdateText(text.id, { text: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="bg-transparent border-none outline-none text-center min-w-[100px]"
                          style={{
                            fontSize: 'inherit',
                            fontFamily: text.fontFamily,
                            color: text.color,
                          }}
                        />
                      ) : (
                        text.text
                      )}
                    </div>
                  ))}

                  {/* Postcard border */}
                  <div className="absolute inset-[3%] border border-gray-200 rounded pointer-events-none" />
                </div>

                {/* Back Side */}
                <div className="postcard-face postcard-back">
                  <div className="absolute inset-0 bg-[#faf8f4] p-[5%] flex">
                    {/* Left side - Message */}
                    <div className="flex-1 pr-[4%] border-r border-gray-300 flex flex-col">
                      <div className="flex-1">
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Write your message here..."
                          onClick={(e) => e.stopPropagation()}
                          className="w-full h-full bg-transparent text-gray-700 resize-none outline-none placeholder-gray-400"
                          style={{ 
                            fontFamily: 'Georgia, serif', 
                            lineHeight: '1.8',
                            fontSize: 'clamp(12px, 1.5vw, 18px)',
                          }}
                        />
                      </div>
                      <div className="pt-[3%] border-t border-gray-200 mt-[3%]">
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Your name"
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-transparent text-gray-700 outline-none placeholder-gray-400"
                          style={{ 
                            fontFamily: 'Georgia, serif',
                            fontSize: 'clamp(12px, 1.5vw, 18px)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Right side - Address */}
                    <div className="flex-1 pl-[4%] flex flex-col">
                      {/* Stamp area */}
                      <div className="flex justify-end mb-[8%]">
                        <div 
                          className="border-2 border-dashed border-gray-300 rounded flex items-center justify-center"
                          style={{ width: 'clamp(40px, 8vw, 80px)', height: 'clamp(50px, 10vw, 100px)' }}
                        >
                          <span className="text-gray-300 text-center" style={{ fontSize: 'clamp(8px, 1vw, 12px)' }}>STAMP</span>
                        </div>
                      </div>

                      {/* Address lines */}
                      <div className="flex-1 space-y-[6%]">
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Recipient name"
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-transparent text-gray-700 outline-none placeholder-gray-400 border-b border-gray-200 pb-1"
                          style={{ fontSize: 'clamp(12px, 1.5vw, 18px)' }}
                        />
                        <textarea
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          placeholder="Address line 1&#10;City, State ZIP"
                          onClick={(e) => e.stopPropagation()}
                          rows={3}
                          className="w-full bg-transparent text-gray-700 resize-none outline-none placeholder-gray-400"
                          style={{ 
                            lineHeight: '2',
                            fontSize: 'clamp(12px, 1.5vw, 18px)',
                          }}
                        />
                      </div>

                      {/* Postcard indicator */}
                      <div className="text-right">
                        <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: 'clamp(10px, 1vw, 14px)' }}>Postcard</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Section - Always below the card */}
        <div className="mt-6 md:mt-8 flex flex-col items-center gap-4">
          {/* Text Editor Controls */}
          {!isFlipped && (
            <div className="w-full max-w-md">
              {editingText ? (
                <div className="bg-white border border-gray-200 rounded-md p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Editing: {editingText.text.substring(0, 20)}{editingText.text.length > 20 ? '...' : ''}</span>
                    <button
                      onClick={() => handleDeleteText(editingTextId!)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Font Size */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-500 w-16">Size</label>
                      <input
                        type="range"
                        min="12"
                        max="64"
                        value={editingText.fontSize}
                        onChange={(e) => handleUpdateText(editingTextId!, { fontSize: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-600 w-10 text-right">{editingText.fontSize}px</span>
                    </div>
                    
                    {/* Color & Font */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-500 w-16">Style</label>
                      <input
                        type="color"
                        value={editingText.color}
                        onChange={(e) => handleUpdateText(editingTextId!, { color: e.target.value })}
                        className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                      />
                      <select
                        value={editingText.fontFamily}
                        onChange={(e) => handleUpdateText(editingTextId!, { fontFamily: e.target.value })}
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
                      >
                        <option value="Inter">Inter</option>
                        <option value="Libre Baskerville">Libre Baskerville</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Arial">Arial</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-2">Click on text to edit, or add new text</p>
                </div>
              )}
              
              {/* Add Text Button */}
              <button
                onClick={handleAddText}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Text
              </button>
            </div>
          )}

          {/* Flip Toggle */}
          <button
            onClick={handleFlip}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {isFlipped ? 'Edit Front' : 'Edit Back'}
          </button>
        </div>
      </div>
    </SimplePageLayout>
  );
}

