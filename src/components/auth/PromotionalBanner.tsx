'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MapPinIcon, HeartIcon, UserPlusIcon, XMarkIcon, SparklesIcon, ChevronLeftIcon, ChevronRightIcon, UserIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

interface MentionType {
  id: string;
  emoji: string;
  name: string;
}

// Discover Minnesota Animation Component - Cursor hovers over mention types
function DiscoverMinnesotaAnimation({ mentionTypes }: { mentionTypes: MentionType[] }) {
  const [cursorPosition, setCursorPosition] = useState({ x: 10, y: 15 });
  const [hoveredTypeId, setHoveredTypeId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const stateRef = useRef({ 
    currentIndex: 0, 
    currentPos: { x: 10, y: 15 },
    isMoving: false 
  });

  // Calculate positions based on actual card positions
  const getTypePositions = () => {
    const types = mentionTypes.slice(0, 6);
    const positions: Array<{ x: number; y: number; id: string }> = [];
    
    if (!containerRef.current) return positions;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    types.forEach((type) => {
      const cardElement = cardRefs.current.get(type.id);
      if (cardElement) {
        const cardRect = cardElement.getBoundingClientRect();
        // Calculate center position as percentage
        const x = ((cardRect.left + cardRect.width / 2 - containerRect.left) / containerRect.width) * 100;
        const y = ((cardRect.top + cardRect.height / 2 - containerRect.top) / containerRect.height) * 100;
        positions.push({ x, y, id: type.id });
      }
    });

    return positions;
  };

  useEffect(() => {
    // Wait for cards to render before calculating positions
    let hoverTimeout: NodeJS.Timeout | null = null;
    let animationRunning = true;

    const timeout = setTimeout(() => {
      const positions = getTypePositions();
      if (positions.length === 0 || !animationRunning) return;

      const animate = () => {
        if (!animationRunning) return;
        
        const state = stateRef.current;
        const currentPositions = getTypePositions();
        if (currentPositions.length === 0) {
          animationRef.current = requestAnimationFrame(animate);
          return;
        }
        
        const targetPos = currentPositions[state.currentIndex];
        const currentPos = state.currentPos;
        
        // Calculate distance and move cursor
        const dx = targetPos.x - currentPos.x;
        const dy = targetPos.y - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 1 && !state.isMoving) {
          // Move cursor towards target
          const speed = 0.4;
          const newX = currentPos.x + dx * speed;
          const newY = currentPos.y + dy * speed;
          
          state.currentPos = { x: newX, y: newY };
          setCursorPosition({ x: newX, y: newY });
        } else if (distance <= 1 && !state.isMoving) {
          // Reached target - hover over it
          state.isMoving = true;
          state.currentPos = targetPos;
          setCursorPosition(targetPos);
          setHoveredTypeId(targetPos.id);
          
          // Stay hovered for a moment, then move to next
          // Step 1: 6 mention types / 10 seconds = ~1.67s per card
          hoverTimeout = setTimeout(() => {
            if (!animationRunning) return;
            setHoveredTypeId(null);
            
            // Move to next position
            state.currentIndex = (state.currentIndex + 1) % currentPositions.length;
            
            // Reset for loop
            if (state.currentIndex === 0) {
              setTimeout(() => {
                if (!animationRunning) return;
                state.currentPos = { x: 10, y: 15 };
                setCursorPosition({ x: 10, y: 15 });
                state.isMoving = false;
              }, 100);
            } else {
              state.isMoving = false;
            }
          }, 1667); // ~1.67s per card (10s / 6 cards)
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    }, 100);

    return () => {
      animationRunning = false;
      clearTimeout(timeout);
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mentionTypes]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Mention Types Grid */}
      <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto">
        {mentionTypes.slice(0, 6).map((type) => (
          <div
            key={type.id}
            ref={(el) => {
              if (el) {
                cardRefs.current.set(type.id, el);
              } else {
                cardRefs.current.delete(type.id);
              }
            }}
            className={`flex items-center gap-2 rounded-md border p-2 transition-all duration-200 ${
              hoveredTypeId === type.id
                ? 'border-red-400 bg-red-50 shadow-md'
                : 'border-gray-200 bg-white'
            }`}
          >
            <span className="text-sm flex-shrink-0">{type.emoji}</span>
            <span className="text-xs font-medium text-gray-900 truncate flex-1">
              {type.name}
            </span>
          </div>
        ))}
      </div>

      {/* Cursor */}
      <div
        className="absolute pointer-events-none z-10 transition-all duration-100 ease-linear"
        style={{
          left: `${cursorPosition.x}%`,
          top: `${cursorPosition.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-100"
        >
          <path
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
            fill="black"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

// Drop Pin Animation Component
function DropPinAnimation() {
  const [pins, setPins] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [cursorPosition, setCursorPosition] = useState({ x: 20, y: 30 });
  const [isClicking, setIsClicking] = useState(false);
  const animationRef = useRef<number>(0);
  const pinIdRef = useRef(0);
  const stateRef = useRef({ currentIndex: 0, currentPos: { x: 20, y: 30 } });

  useEffect(() => {
    // Step 2: 5 actions × 2s = 10s total
    const positions = [
      { x: 20, y: 30 },
      { x: 60, y: 50 },
      { x: 80, y: 70 },
      { x: 40, y: 80 },
      { x: 25, y: 60 },
    ];

    let isMoving = false;
    let clickTimeout: NodeJS.Timeout | null = null;
    let actionStartTime = Date.now();
    let hasDroppedPin = false;

    const animate = () => {
      const state = stateRef.current;
      const targetPos = positions[state.currentIndex];
      const currentPos = state.currentPos;
      const elapsed = Date.now() - actionStartTime;
      
      // Each action should take 2 seconds (5 actions × 2s = 10s total)
      if (elapsed >= 2000) {
        // Time to move to next pin
        state.currentIndex = (state.currentIndex + 1) % 5; // Only 5 pins
        if (state.currentIndex === 0) {
          // Reset for loop
          setPins([]);
          state.currentPos = positions[0];
          setCursorPosition(positions[0]);
        } else {
          state.currentPos = positions[state.currentIndex - 1];
          setCursorPosition(positions[state.currentIndex - 1]);
        }
        actionStartTime = Date.now();
        isMoving = false;
        hasDroppedPin = false;
        setIsClicking(false);
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          clickTimeout = null;
        }
      }
      
      // Calculate distance and move cursor
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 1 && !isMoving) {
        // Move cursor towards target (faster to fit in 2s)
        const speed = 0.8;
        const newX = currentPos.x + dx * speed;
        const newY = currentPos.y + dy * speed;
        
        state.currentPos = { x: newX, y: newY };
        setCursorPosition({ x: newX, y: newY });
      } else if (distance <= 1 && !hasDroppedPin && elapsed < 1800) {
        // Reached target - click and drop pin (within 2s window)
        isMoving = true;
        state.currentPos = targetPos;
        setCursorPosition(targetPos);
        setIsClicking(true);
        hasDroppedPin = true;
        
        // Drop pin after brief click animation
        if (!clickTimeout) {
          clickTimeout = setTimeout(() => {
            setPins((prev) => [...prev, { id: pinIdRef.current++, x: targetPos.x, y: targetPos.y }]);
            setIsClicking(false);
            clickTimeout = null;
          }, 300);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    actionStartTime = Date.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Cursor */}
      <div
        className="absolute pointer-events-none z-10 transition-all duration-100 ease-linear"
        style={{
          left: `${cursorPosition.x}%`,
          top: `${cursorPosition.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-100 ${isClicking ? 'scale-90' : 'scale-100'}`}
        >
          <path
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
            fill="black"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Dropped Pins */}
      {pins.map((pin) => (
        <div
          key={pin.id}
          className="absolute pointer-events-none z-0 animate-pin-drop"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <MapPinIcon className="w-6 h-6 text-red-600" />
        </div>
      ))}
    </div>
  );
}

// Share Your Story Animation Component - Shows pins and maps
function ShareProfileAnimation() {
  const [cursorPosition, setCursorPosition] = useState({ x: 20, y: 20 });
  const [isClicking, setIsClicking] = useState(false);
  const [pins, setPins] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [showMap, setShowMap] = useState(false);
  const [showShareButton, setShowShareButton] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  const animationRef = useRef<number>(0);
  const pinIdRef = useRef(0);
  const stateRef = useRef({ 
    phase: 0, // 0: move to map, 1: click pins, 2: move to share, 3: click share, 4: move to reactions, 5: hover reactions
    currentPos: { x: 20, y: 20 },
    isMoving: false,
    pinIndex: 0
  });

  // Pin positions on map
  const pinPositions = [
    { x: 30, y: 35 },
    { x: 60, y: 45 },
    { x: 75, y: 65 },
    { x: 45, y: 70 },
    { x: 25, y: 55 },
    { x: 70, y: 40 },
  ];

  const positions = {
    map: { x: 50, y: 50 },
    shareButton: { x: 50, y: 75 },
    reactions: { x: 50, y: 85 },
  };

  useEffect(() => {
    let clickTimeout: NodeJS.Timeout | null = null;
    let pinTimeout: NodeJS.Timeout | null = null;

    const animate = () => {
      const state = stateRef.current;
      let targetPos = { x: 20, y: 20 };

      // Step 3: 6 movements / 10 seconds = ~1.67s per movement
      // Movement 1: Move to map, Movement 2: Click pins, Movement 3: Move to share, Movement 4: Click share, Movement 5: Move to reactions, Movement 6: Hover reactions
      if (state.phase === 0) {
        targetPos = positions.map;
      } else if (state.phase === 2) {
        targetPos = positions.shareButton;
      } else if (state.phase === 4) {
        targetPos = positions.reactions;
      } else if (state.phase === 1) {
        // Clicking pins - use current pin position
        const currentPin = pinPositions[state.pinIndex];
        if (currentPin) {
          targetPos = currentPin;
        }
      }

      const currentPos = state.currentPos;
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 2 && !state.isMoving && (state.phase === 0 || state.phase === 2 || state.phase === 4 || (state.phase === 1 && pinPositions[state.pinIndex]))) {
        const speed = 0.5;
        const newX = currentPos.x + dx * speed;
        const newY = currentPos.y + dy * speed;
        
        state.currentPos = { x: newX, y: newY };
        setCursorPosition({ x: newX, y: newY });
      } else if (distance <= 2 && !state.isMoving) {
        state.isMoving = true;
        state.currentPos = targetPos;
        setCursorPosition(targetPos);

        if (state.phase === 0) {
          // Movement 1: Move to map and show it
          setIsClicking(true);
          clickTimeout = setTimeout(() => {
            setIsClicking(false);
            setShowMap(true);
            state.phase = 1;
            state.pinIndex = 0;
            // Don't set position instantly - let animation move to first pin
            state.isMoving = false;
          }, 1670); // ~1.67s to move to map
        } else if (state.phase === 1) {
          // Movement 2: Click pins on map (4 pins, ~420ms each = ~1.67s total)
          // First, move to pin (if not already there), then click
          setIsClicking(true);
          pinTimeout = setTimeout(() => {
            setIsClicking(false);
            // Add pin at current position
            const currentPin = pinPositions[state.pinIndex];
            setPins((prev) => [...prev, { id: pinIdRef.current++, x: currentPin.x, y: currentPin.y }]);
            
            state.pinIndex++;
            if (state.pinIndex >= 4) {
              // Done clicking pins, show share button and transition to phase 2
              setShowShareButton(true);
              state.phase = 2;
              // Don't set position instantly - let animation move to share button
              state.isMoving = false;
            } else {
              // Move to next pin - don't set position instantly, let animation handle it
              state.isMoving = false;
            }
          }, 420); // ~0.42s per pin (movement + click)
        } else if (state.phase === 2) {
          // Movement 3: Click share button (after moving to it)
          setIsClicking(true);
          clickTimeout = setTimeout(() => {
            setIsClicking(false);
            // Hide share button, show reactions
            setShowShareButton(false);
            setShowReactions(true);
            // Animate reaction count
            let count = 0;
            const targetCount = 1200;
            const increment = targetCount / 20;
            const countInterval = setInterval(() => {
              count += increment;
              if (count >= targetCount) {
                count = targetCount;
                clearInterval(countInterval);
              }
              setReactionCount(Math.floor(count));
            }, 50);
            
            state.phase = 3;
            state.isMoving = false;
            setTimeout(() => {
              state.phase = 4;
              state.currentPos = positions.shareButton;
              setCursorPosition(positions.shareButton);
              state.isMoving = false;
            }, 1670); // ~1.67s before moving to reactions
          }, 1670); // ~1.67s click action
        } else if (state.phase === 4) {
          // Movement 5: Move to reactions, Movement 6: Hover reactions
          setIsClicking(false);
          state.phase = 5;
          state.isMoving = false;
          // Hover reactions for ~1.67s, then reset
          setTimeout(() => {
            setPins([]);
            setShowMap(false);
            setShowShareButton(false);
            setShowReactions(false);
            setReactionCount(0);
            pinIdRef.current = 0;
            state.phase = 0;
            state.pinIndex = 0;
            state.currentPos = { x: 20, y: 20 };
            setCursorPosition({ x: 20, y: 20 });
            state.isMoving = false;
          }, 1670); // ~1.67s hover
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
      if (pinTimeout) {
        clearTimeout(pinTimeout);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative rounded-md p-3">
      {/* Map with Pins */}
      {showMap && (
        <div className="h-full bg-gray-100 rounded border border-gray-200 relative overflow-hidden">
          {/* Map background */}
          <div className="absolute inset-0 opacity-30">
            <div className="w-full h-full" style={{
              backgroundImage: 'linear-gradient(135deg, #e5e7eb 25%, transparent 25%), linear-gradient(225deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(315deg, #e5e7eb 25%, transparent 25%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 0, 10px -10px, 0px 10px'
            }} />
          </div>
          
          {/* Pins on map */}
          {pins.map((pin) => (
            <div
              key={pin.id}
              className="absolute pointer-events-none z-0"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <MapPinIcon className="w-5 h-5 text-red-600" />
            </div>
          ))}
        </div>
      )}

      {/* Share Button - Show after pins */}
      {showShareButton && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <button className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700">
            Share Profile
          </button>
        </div>
      )}

      {/* People Reacting Count - Show after share */}
      {showReactions && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 justify-center bg-white px-3 py-2 rounded-md border border-gray-200 shadow-sm">
            <HeartIcon className="w-4 h-4 text-red-600" />
            <span className="text-xs text-gray-600 font-medium">
              {reactionCount >= 1000 
                ? `${(reactionCount / 1000).toFixed(1)}k` 
                : reactionCount.toLocaleString()} people reacted
            </span>
          </div>
        </div>
      )}

      {/* Cursor */}
      <div
        className="absolute pointer-events-none z-10 transition-all duration-100 ease-linear"
        style={{
          left: `${cursorPosition.x}%`,
          top: `${cursorPosition.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-100 ${isClicking ? 'scale-90' : 'scale-100'}`}
        >
          <path
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
            fill="black"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

// Custom Maps Animation Component - Shows map editing with floating input
function CustomMapsAnimation() {
  const [cursorPosition, setCursorPosition] = useState({ x: 20, y: 20 });
  const [isClicking, setIsClicking] = useState(false);
  const [mapName, setMapName] = useState('');
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [visibility, setVisibility] = useState('Private');
  const animationRef = useRef<number>(0);
  const stateRef = useRef({ 
    phase: 0, // 0: move to name input, 1: click input, 2: type name, 3: move to visibility, 4: click visibility, 5: select option
    currentPos: { x: 20, y: 20 },
    isMoving: false 
  });

  const positions = {
    visibilityButton: { x: 50, y: 15 },
    visibilityOption: { x: 50, y: 25 },
    nameInput: { x: 50, y: 85 },
  };

  useEffect(() => {
    let typeTimeout: NodeJS.Timeout | null = null;
    let clickTimeout: NodeJS.Timeout | null = null;

    const animate = () => {
      const state = stateRef.current;
      let targetPos = { x: 20, y: 20 };

      if (state.phase === 0) {
        targetPos = positions.nameInput; // Start at bottom (name input)
      } else if (state.phase === 3) {
        targetPos = positions.visibilityButton; // Then move to top (visibility)
      } else if (state.phase === 5) {
        targetPos = positions.visibilityOption;
      }

      const currentPos = state.currentPos;
      const dx = targetPos.x - currentPos.x;
      const dy = targetPos.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 2 && !state.isMoving && (state.phase === 0 || state.phase === 3 || state.phase === 5)) {
        const speed = 0.5;
        const newX = currentPos.x + dx * speed;
        const newY = currentPos.y + dy * speed;
        
        state.currentPos = { x: newX, y: newY };
        setCursorPosition({ x: newX, y: newY });
      } else if (distance <= 2 && !state.isMoving) {
        state.isMoving = true;
        state.currentPos = targetPos;
        setCursorPosition(targetPos);

        // Step 5: 3 actions × 3.3s = 10s total
        // Action 1: Type name (3.3s), Action 2: Set visibility (3.3s), Action 3: Show result (3.4s) = 10s
        if (state.phase === 0) {
          setIsClicking(true);
          clickTimeout = setTimeout(() => {
            setIsClicking(false);
            state.phase = 1;
            state.isMoving = false;
            setTimeout(() => {
              state.phase = 2;
              state.isMoving = false;
              // Type map name (3.3s total)
              const mapNameText = 'my map';
              let charIndex = 0;
              const typeInterval = setInterval(() => {
                if (charIndex < mapNameText.length) {
                  setMapName(mapNameText.slice(0, charIndex + 1));
                  charIndex++;
                } else {
                  clearInterval(typeInterval);
                  setTimeout(() => {
                    state.phase = 3;
                    state.currentPos = positions.visibilityButton;
                    setCursorPosition(positions.visibilityButton);
                    state.isMoving = false;
                  }, 500);
                }
              }, 3300 / mapNameText.length); // Adjust for 3.3s typing
            }, 300);
          }, 300);
        } else if (state.phase === 3) {
          setIsClicking(true);
          clickTimeout = setTimeout(() => {
            setIsClicking(false);
            state.phase = 4;
            state.isMoving = false;
            setShowVisibilityDropdown(true);
            setTimeout(() => {
              state.phase = 5;
              state.currentPos = positions.visibilityButton;
              setCursorPosition(positions.visibilityButton);
              state.isMoving = false;
            }, 300);
          }, 300);
        } else if (state.phase === 5) {
          setIsClicking(true);
          clickTimeout = setTimeout(() => {
            setIsClicking(false);
            setVisibility('Public');
            setShowVisibilityDropdown(false);
            // Reset after showing complete flow (3.4s to complete 10s cycle)
            setTimeout(() => {
              setMapName('');
              setVisibility('Private');
              state.phase = 0;
              state.currentPos = { x: 20, y: 20 };
              setCursorPosition({ x: 20, y: 20 });
              state.isMoving = false;
            }, 3400);
          }, 300);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (typeTimeout) {
        clearTimeout(typeTimeout);
      }
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Map Preview - Always visible */}
      <div className="h-full flex flex-col">
        <div className="flex-1 bg-gray-100 rounded flex items-center justify-center relative overflow-hidden">
          {/* Map pins/visualization */}
          <div className="absolute inset-0">
            {[20, 40, 60, 80].map((x, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${x}%`,
                  top: `${30 + i * 15}%`,
                }}
              >
                <MapPinIcon className="w-4 h-4 text-red-600" />
              </div>
            ))}
          </div>
          <div className="text-center z-10">
            <MapPinIcon className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <div className="text-xs text-gray-500">Minnesota Map</div>
          </div>
        </div>
      </div>

      {/* Floating Visibility Dropdown - Top */}
      <div
        className="absolute bg-white border border-gray-300 rounded-md shadow-lg z-20"
        style={{
          left: `${positions.visibilityButton.x}%`,
          top: `${positions.visibilityButton.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <button
          className="text-xs px-2 py-1 text-gray-700 flex items-center gap-1"
          onClick={(e) => e.preventDefault()}
        >
          {visibility}
          <ChevronRightIcon className="w-3 h-3" />
        </button>
        {showVisibilityDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg min-w-full">
            <button
              className="text-xs px-2 py-1 text-gray-700 hover:bg-gray-50 w-full text-left"
              onClick={(e) => e.preventDefault()}
            >
              Private
            </button>
            <button
              className="text-xs px-2 py-1 text-gray-700 hover:bg-gray-50 w-full text-left"
              onClick={(e) => e.preventDefault()}
            >
              Public
            </button>
          </div>
        )}
      </div>

      {/* Floating Input - Name - Bottom */}
      <div
        className="absolute bg-white border border-gray-300 rounded-md shadow-lg p-2 z-20"
        style={{
          left: `${positions.nameInput.x}%`,
          top: `${positions.nameInput.y}%`,
          transform: 'translate(-50%, -50%)',
          minWidth: '120px',
        }}
      >
        <input
          type="text"
          readOnly
          value={mapName}
          placeholder="Map name..."
          className="text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-900 w-full"
        />
      </div>

      {/* Cursor */}
      <div
        className="absolute pointer-events-none z-30 transition-all duration-100 ease-linear"
        style={{
          left: `${cursorPosition.x}%`,
          top: `${cursorPosition.y}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transition-transform duration-100 ${isClicking ? 'scale-90' : 'scale-100'}`}
        >
          <path
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
            fill="black"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

// Smart News Animation Component - 6 news sources with cursor clicking each
function SmartNewsAnimation() {
  // Position 6 icons in a circle around center (50%, 50%)
  const radius = 35; // percentage distance from center
  const newsSources = [
    { id: 1, label: 'STP', angle: 0 }, // Star Tribune - top
    { id: 2, label: 'MNP', angle: 60 }, // MPR News - top-right
    { id: 3, label: 'WCCO', angle: 120 }, // WCCO - bottom-right
    { id: 4, label: 'KARE', angle: 180 }, // KARE 11 - bottom
    { id: 5, label: 'FOX9', angle: 240 }, // FOX 9 - bottom-left
    { id: 6, label: 'CBS', angle: 300 }, // CBS Minnesota - top-left
  ].map((source) => {
    const rad = (source.angle * Math.PI) / 180;
    return {
      ...source,
      x: 50 + radius * Math.sin(rad),
      y: 50 - radius * Math.cos(rad),
    };
  });

  const [cursorPosition, setCursorPosition] = useState({ x: 20, y: 20 });
  const [isClicking, setIsClicking] = useState(false);
  const [clickedSources, setClickedSources] = useState<number[]>([]);
  const [centerIconScale, setCenterIconScale] = useState(1);
  const animationRef = useRef<number>(0);
  const stateRef = useRef({
    currentIndex: 0,
    phase: 'moving' as 'moving' | 'clicking' | 'pausing',
    startTime: 0,
  });

  useEffect(() => {
    const animate = () => {
      const state = stateRef.current;
      const currentSource = newsSources[state.currentIndex];
      
      if (!currentSource) {
        // Reset animation
        state.currentIndex = 0;
        setClickedSources([]);
        setCenterIconScale(1);
        setCursorPosition({ x: newsSources[0].x, y: newsSources[0].y });
        state.phase = 'moving';
        state.startTime = Date.now();
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = Date.now();
      const elapsed = now - state.startTime;

      // Step 4: 6 sources / 10 seconds = ~1.67s per source
      if (state.phase === 'moving') {
        // Move cursor to current source position (~1.2s to fit in 1.67s total)
        const startPos = state.currentIndex === 0 
          ? { x: newsSources[0].x, y: newsSources[0].y }
          : { x: newsSources[state.currentIndex - 1].x, y: newsSources[state.currentIndex - 1].y };
        
        const targetPos = { x: currentSource.x, y: currentSource.y };
        const duration = 1200; // 1.2s to move
        const progress = Math.min(elapsed / duration, 1);
        
        const currentX = startPos.x + (targetPos.x - startPos.x) * progress;
        const currentY = startPos.y + (targetPos.y - startPos.y) * progress;
        
        setCursorPosition({ x: currentX, y: currentY });

        if (progress >= 1) {
          // Reached target, start clicking
          state.phase = 'clicking';
          state.startTime = now;
          setIsClicking(true);
        }
      } else if (state.phase === 'clicking') {
        // Click animation (200ms)
        if (elapsed < 100) {
          // Click down
        } else if (elapsed < 200) {
          // Click up - add to clicked sources and grow center icon
          if (!clickedSources.includes(currentSource.id)) {
            setClickedSources((prev) => [...prev, currentSource.id]);
            setCenterIconScale((prev) => prev + 0.15);
          }
        } else {
          // Click complete, pause then move to next (~270ms pause for total 1.67s)
          setIsClicking(false);
          state.phase = 'pausing';
          state.startTime = now;
        }
      } else if (state.phase === 'pausing') {
        // Pause before moving to next (total action = 1.67s: 1.2s move + 0.2s click + 0.27s pause)
        if (elapsed >= 270) {
          state.currentIndex++;
          state.phase = 'moving';
          state.startTime = now;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    stateRef.current.startTime = Date.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [clickedSources]);

  return (
    <div className="w-full h-full relative rounded-md p-3 flex items-center justify-center">
      <div className="relative w-full h-full">
        {/* Center News Icon */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 transition-transform duration-300 ease-out"
          style={{
            transform: `translate(-50%, -50%) scale(${centerIconScale})`,
          }}
        >
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center border-2 border-red-700 shadow-lg">
            <SparklesIcon className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* News Source Icons */}
        {newsSources.map((source) => (
          <div
            key={source.id}
            className={`absolute z-10 transition-all duration-200 ${
              clickedSources.includes(source.id)
                ? 'opacity-60 scale-95'
                : 'opacity-100 scale-100'
            }`}
            style={{
              left: `${source.x}%`,
              top: `${source.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-12 h-12 rounded-md border-2 border-gray-300 bg-white flex items-center justify-center shadow-sm hover:border-gray-400">
              <span className="text-xs font-semibold text-gray-700">
                {source.label}
              </span>
            </div>
          </div>
        ))}

        {/* Cursor */}
        <div
          className="absolute pointer-events-none z-20 transition-all duration-75 ease-linear"
          style={{
            left: `${cursorPosition.x}%`,
            top: `${cursorPosition.y}%`,
            transform: `translate(-50%, -50%) ${isClicking ? 'scale(0.9)' : 'scale(1)'}`,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
              fill="black"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

interface PromotionalBannerProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function PromotionalBanner({ isOpen, onClose }: PromotionalBannerProps) {
  const { openWelcome } = useAppModalContextSafe();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [hasStoredEmail, setHasStoredEmail] = useState(false);
  const [autoAdvancePaused, setAutoAdvancePaused] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [rememberedUsername, setRememberedUsername] = useState<string | null>(null);
  const [rememberedImage, setRememberedImage] = useState<string | null>(null);
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [isBannerLoading, setIsBannerLoading] = useState(true);
  const supabase = useSupabaseClient();

  // Check if user has stored email and remembered account info
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const email = localStorage.getItem('user_email');
      setHasStoredEmail(!!email);
      setStoredEmail(email);
      
      // Load remembered account info
      const lastUsername = localStorage.getItem('last_account_username');
      const lastImage = localStorage.getItem('last_account_image');
      setRememberedUsername(lastUsername);
      setRememberedImage(lastImage);
    }
  }, []);

  // Carousel steps: 4 content steps
  // Headings max 18 characters, no truncation
  const steps = [
    {
      heading: 'Share What Matters',
      description: 'Post what you love about Minnesota—places, people, businesses, memories, moments, or things happening right now—and pin them directly to the map.',
    },
    {
      heading: 'Discover Together',
      description: 'Explore what others love across the state in real time or through history, filtered by place, time, and interest—Minnesota through the eyes of its people.',
    },
    {
      heading: 'Build Your Map',
      description: 'Create custom maps to organize what matters to you or your business—projects, reviews, communities, job sites, events, or stories—fully owned and controlled by you.',
    },
    {
      heading: 'Turn Love Actionable',
      description: "Use maps as living tools for connection, visibility, and growth—share publicly, keep private, or invite others to collaborate on what you're building.",
    },
  ];

  // Prevent body scroll when banner is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Show loading state initially, then hide after a brief delay
      setIsBannerLoading(true);
      const timer = setTimeout(() => {
        setIsBannerLoading(false);
      }, 800); // 800ms loading delay
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = '';
      setIsBannerLoading(true);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Auto-advance carousel every 10 seconds (paused when user manually navigates)
  useEffect(() => {
    if (!isOpen || autoAdvancePaused) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        // Loop: 0 -> 1 -> 2 -> 3 -> 0
        return (prev + 1) % steps.length;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [isOpen, steps.length, autoAdvancePaused]);

  // Reset to step 0 when banner opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  // Navigation functions
  const goToPreviousStep = () => {
    setAutoAdvancePaused(true);
    setCurrentStep((prev) => (prev === 0 ? steps.length - 1 : prev - 1));
    // Resume auto-advance after 15 seconds of inactivity
    setTimeout(() => setAutoAdvancePaused(false), 15000);
  };

  const goToNextStep = () => {
    setAutoAdvancePaused(true);
    setCurrentStep((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
    // Resume auto-advance after 15 seconds of inactivity
    setTimeout(() => setAutoAdvancePaused(false), 15000);
  };

  // Fetch mention types
  useEffect(() => {
    if (!isOpen) return;

    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (error) {
        console.error('Failed to fetch mention types:', error);
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchMentionTypes();
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-md rounded-md bg-white border border-gray-200 shadow-xl transition-all duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {isBannerLoading ? (
          <div className="flex items-center justify-center p-8 min-h-[400px]">
            <Image
              src="/full_text_split.png"
              alt="Loading"
              width={400}
              height={100}
              className="w-auto h-auto max-w-[90%] max-h-[20%] object-contain"
              priority
            />
          </div>
        ) : (
          <>
            {/* Header - Close button */}
            {onClose && (
              <div className="flex-shrink-0 flex justify-end p-[10px]">
                <button
                  onClick={onClose}
                  className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}

            {/* Main Content - Scrollable */}
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center px-4 pb-8 min-h-0">
            <div className="w-full text-center space-y-6 flex flex-col items-center py-8">
            {/* Logo with Navigation Arrows */}
            <div className="relative flex items-center justify-between w-full">
              {/* Left Arrow */}
              <button
                onClick={goToPreviousStep}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Previous step"
              >
                <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
              </button>

              {/* Logo - Centered */}
              <div className="absolute left-1/2 -translate-x-1/2 flex justify-center">
                <Image
                  src="/logo.png"
                  alt="For the Love of Minnesota"
                  width={120}
                  height={32}
                  className="h-8 w-auto"
                  priority
                />
              </div>

              {/* Right Arrow */}
              <button
                onClick={goToNextStep}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0 ml-auto"
                aria-label="Next step"
              >
                <ChevronRightIcon className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Carousel */}
            <div className="relative min-h-[300px] flex items-center justify-center">
              <div className="w-full">
                <div
                  key={currentStep}
                  className="space-y-2 carousel-fade-in text-center"
                >
                  {/* Heading and Description */}
                  <div className="pb-1">
                    <h1 className="text-3xl font-bold text-gray-900 break-words">
                      {steps[currentStep].heading}
                    </h1>
                  </div>
                  <p className="text-base text-gray-600 pb-4">
                    {steps[currentStep].description}
                  </p>

                  {/* Rounded bordered container */}
                  <div className="w-full h-[300px] rounded-md border border-gray-200 bg-gray-100 mb-2 p-3 overflow-hidden relative">
                    {currentStep === 0 ? (
                      // Share What Matters animation for step 0
                      <DropPinAnimation />
                    ) : currentStep === 1 ? (
                      // Discover Together animation for step 1
                      loadingTypes ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-xs text-gray-500">Loading...</div>
                        </div>
                      ) : mentionTypes.length > 0 ? (
                        <DiscoverMinnesotaAnimation mentionTypes={mentionTypes} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-xs text-gray-500">No mention types available</div>
                        </div>
                      )
                    ) : currentStep === 2 ? (
                      // Build Your Map animation for step 2
                      <CustomMapsAnimation />
                    ) : currentStep === 3 ? (
                      // Turn Love Actionable animation for step 3
                      <div className="w-full h-full" />
                    ) : (
                      // Empty container for other steps
                      <div className="w-full h-full" />
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="flex items-center gap-2 justify-center pt-4">
                    {steps.map((_, index) => (
                      <div
                        key={index}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          currentStep === index
                            ? 'bg-red-600 flex-1 max-w-[80px]'
                            : 'bg-gray-200 flex-1 max-w-[80px]'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button - Full Width */}
            <div className="w-full space-y-3">
            {rememberedUsername ? (
                <>
                  {/* Remembered Account Profile Card */}
                  <button
                    onClick={openWelcome}
                    className="w-full bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-md transition-colors p-4 flex flex-col items-center gap-3"
                  >
                    {rememberedImage ? (
                      <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                        <Image
                          src={rememberedImage}
                          alt={rememberedUsername}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          unoptimized={rememberedImage.includes('supabase.co')}
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border border-gray-200">
                        <UserIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex flex-col items-center min-w-0 w-full">
                      <div className="text-lg font-semibold text-gray-900 truncate">
                        @{rememberedUsername}
                      </div>
                      {storedEmail && (
                        <div className="text-xs text-gray-500 truncate">
                          {storedEmail}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Log back in
                      </div>
                    </div>
                  </button>
                  
                  {/* Sign in with Email Button - Only show when remembered account exists */}
                  <button
                    onClick={() => {
                      // Set flag to skip pre-filling email when opening welcome modal
                      // This allows user to enter a different email
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('temp_cleared_email', 'true');
                      }
                      openWelcome();
                    }}
                    className="w-full px-6 py-3 text-base font-medium text-gray-900 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <EnvelopeIcon className="w-5 h-5 text-gray-600" />
                    Sign in with Email
                  </button>
                  
                  {/* Google Auth Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowComingSoon(true)}
                      onMouseEnter={() => setShowComingSoon(true)}
                      onMouseLeave={() => setShowComingSoon(false)}
                      className="w-full px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 hover:opacity-90 active:opacity-80 active:scale-[0.98] rounded-md transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </button>
                    {showComingSoon && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-md whitespace-nowrap pointer-events-none z-10">
                        Coming Soon
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={openWelcome}
                    className="w-full px-6 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                  >
                    Get Started
                  </button>
                  
                  {/* Google Auth Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowComingSoon(true)}
                      onMouseEnter={() => setShowComingSoon(true)}
                      onMouseLeave={() => setShowComingSoon(false)}
                      className="w-full px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 hover:opacity-90 active:opacity-80 active:scale-[0.98] rounded-md transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </button>
                    {showComingSoon && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-md whitespace-nowrap pointer-events-none z-10">
                        Coming Soon
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer Text */}
            <p className="text-xs text-gray-500 pt-2">
              Free to join • No credit card required
            </p>
            </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
