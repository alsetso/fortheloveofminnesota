'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { buildUrlRegex } from '@/lib/posts/parseUrls';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  onFocus?: () => void;
  onBlur?: () => void;
  mentionColor?: 'blue' | 'white';
}

export interface MentionTextareaRef {
  focus: () => void;
  blur: () => void;
  setSelectionRange: (start: number, end: number) => void;
  scrollHeight: number;
  style: CSSStyleDeclaration;
}

const MentionTextarea = forwardRef<MentionTextareaRef, MentionTextareaProps>(
  ({ value, onChange, placeholder, className = '', maxLength, autoFocus, style, onFocus, onBlur, mentionColor = 'blue' }, ref) => {
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const placeholderRef = useRef<HTMLDivElement>(null);
    const isComposingRef = useRef(false);
    const isInternalChangeRef = useRef(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isEmpty, setIsEmpty] = useState(!value || value.trim().length === 0);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        contentEditableRef.current?.focus();
      },
      blur: () => {
        contentEditableRef.current?.blur();
      },
      setSelectionRange: (start: number, end: number) => {
        const element = contentEditableRef.current;
        if (!element) return;
        
        const textNode = getTextNode(element);
        if (!textNode) return;
        
        const range = document.createRange();
        const selection = window.getSelection();
        
        try {
          if (textNode.nodeType === Node.TEXT_NODE) {
            const maxOffset = textNode.textContent?.length || 0;
            const safeStart = Math.min(start, maxOffset);
            const safeEnd = Math.min(end, maxOffset);
            
            range.setStart(textNode, safeStart);
            range.setEnd(textNode, safeEnd);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        } catch (e) {
          // Fallback: just focus
          element.focus();
        }
      },
      get scrollHeight() {
        return contentEditableRef.current?.scrollHeight || 0;
      },
      get style() {
        return contentEditableRef.current?.style || ({} as CSSStyleDeclaration);
      },
    }));

    // Build DOM structure with styled mentions and URLs
    const buildStyledContent = (element: HTMLElement, text: string) => {
      if (!text || text.trim().length === 0) {
        // Clear content - contenteditable handles empty state naturally
        element.textContent = '';
        return;
      }

      const usernameRegex = /@([a-zA-Z0-9][a-zA-Z0-9_-]*)/g;
      const urlRegex = buildUrlRegex();
      
      // Collect all matches (mentions and URLs) with their positions
      interface Match {
        type: 'mention' | 'url';
        start: number;
        end: number;
        content: string;
      }
      
      const matches: Match[] = [];
      
      // Find all mentions
      let match;
      usernameRegex.lastIndex = 0;
      while ((match = usernameRegex.exec(text)) !== null) {
        matches.push({
          type: 'mention',
          start: match.index,
          end: match.index + match[0].length,
          content: match[0],
        });
      }
      
      // Find all URLs (excluding those that are part of mentions)
      urlRegex.lastIndex = 0;
      while ((match = urlRegex.exec(text)) !== null) {
        // Check if this URL is part of a mention (e.g., @username.com)
        const beforeMatch = text.substring(Math.max(0, match.index! - 1), match.index!);
        if (!beforeMatch.endsWith('@')) {
          // match[1] is the captured URL, match[0] includes preceding character
          const urlContent = match[1] || match[0];
          const urlStart = match.index! + (match[0].length - urlContent.length);
          matches.push({
            type: 'url',
            start: urlStart,
            end: urlStart + urlContent.length,
            content: urlContent,
          });
        }
      }
      
      // Sort matches by start position
      matches.sort((a, b) => a.start - b.start);
      
      // Remove overlapping matches (prefer mentions over URLs if they overlap)
      const filteredMatches: Match[] = [];
      for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        let overlaps = false;
        
        // Check if this match overlaps with any previous match
        for (const prev of filteredMatches) {
          if (
            (current.start >= prev.start && current.start < prev.end) ||
            (current.end > prev.start && current.end <= prev.end) ||
            (current.start <= prev.start && current.end >= prev.end)
          ) {
            overlaps = true;
            // If current is a mention and prev is a URL, replace the URL
            if (current.type === 'mention' && prev.type === 'url') {
              const index = filteredMatches.indexOf(prev);
              filteredMatches[index] = current;
            }
            break;
          }
        }
        
        if (!overlaps) {
          filteredMatches.push(current);
        }
      }
      
      // Build parts array
      const parts: Array<{ type: 'text' | 'mention' | 'url'; content: string }> = [];
      let lastIndex = 0;
      
      for (const match of filteredMatches) {
        // Add text before the match
        if (match.start > lastIndex) {
          parts.push({
            type: 'text',
            content: text.substring(lastIndex, match.start),
          });
        }
        
        // Add the match
        parts.push({
          type: match.type,
          content: match.content,
        });
        
        lastIndex = match.end;
      }
      
      // Add remaining text
      if (lastIndex < text.length) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex),
        });
      }

      // Clear and rebuild DOM
      element.innerHTML = '';
      parts.forEach((part) => {
        if (part.type === 'mention') {
          const span = document.createElement('span');
          span.className = mentionColor === 'white' 
            ? 'text-white font-medium' 
            : 'text-blue-600 font-medium';
          span.textContent = part.content;
          element.appendChild(span);
        } else if (part.type === 'url') {
          const span = document.createElement('span');
          span.className = mentionColor === 'white' 
            ? 'text-white font-medium underline' 
            : 'text-blue-600 font-medium underline';
          span.textContent = part.content;
          element.appendChild(span);
        } else {
          const textNode = document.createTextNode(part.content);
          element.appendChild(textNode);
        }
      });
    };

    // Get text content from contenteditable (preserves spaces and all characters)
    const getTextContent = (element: HTMLElement): string => {
      // Use textContent to get plain text with all spaces preserved
      // innerText can collapse whitespace, so textContent is better
      let text = element.textContent || '';
      
      // Remove any zero-width spaces we might have added
      text = text.replace(/\u200B/g, '');
      
      return text;
    };

    // Get text node for cursor positioning
    const getTextNode = (element: HTMLElement): Node | null => {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );
      return walker.nextNode();
    };

    // Helper to restore cursor position based on plain text offset
    const restoreCursorPosition = (element: HTMLElement, offset: number) => {
      if (offset < 0) {
        offset = 0;
      }
      
      // Get all text nodes in order
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      const textNodes: Array<{ node: Node; startOffset: number; length: number }> = [];
      let currentOffset = 0;
      let node;
      
      // Collect all text nodes with their positions
      while ((node = walker.nextNode())) {
        const nodeLength = node.textContent?.length || 0;
        textNodes.push({
          node,
          startOffset: currentOffset,
          length: nodeLength,
        });
        currentOffset += nodeLength;
      }
      
      // Find the target node and offset
      let targetNode: Node | null = null;
      let targetOffset = 0;
      
      for (const { node, startOffset, length } of textNodes) {
        if (startOffset + length >= offset) {
          // Found the node containing our target offset
          targetNode = node;
          targetOffset = offset - startOffset;
          break;
        }
      }
      
      // If offset is beyond all content, place at the end of the last node
      if (!targetNode && textNodes.length > 0) {
        const last = textNodes[textNodes.length - 1];
        targetNode = last.node;
        targetOffset = last.length;
      }
      
      // If still no node, element is empty - create a text node or use the element itself
      if (!targetNode) {
        // Try to place cursor at the start of the element
        try {
          const range = document.createRange();
          range.setStart(element, 0);
          range.setEnd(element, 0);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } catch (e) {
          // Element might not support range, try focusing
          element.focus();
        }
        return;
      }
      
      // Restore the cursor at the calculated position
      try {
        const newRange = document.createRange();
        const maxOffset = targetNode.textContent?.length || 0;
        const safeOffset = Math.min(Math.max(0, targetOffset), maxOffset);
        
        newRange.setStart(targetNode, safeOffset);
        newRange.setEnd(targetNode, safeOffset);
        
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          // Ensure element is focused
          if (document.activeElement !== element) {
            element.focus();
          }
        }
      } catch (e) {
        // Fallback: just focus the element
        element.focus();
      }
    };

    // Calculate cursor offset based on plain text content (not DOM structure)
    const getCursorOffsetFromText = (element: HTMLElement, range: Range): number => {
      if (!range) {
        // If no range, cursor is at the end
        return getTextContent(element).length;
      }
      
      // Get all text content up to the cursor position
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let offset = 0;
      let node;
      
      while ((node = walker.nextNode())) {
        if (node === range.startContainer) {
          // Found the node containing the cursor
          // range.startOffset is the character position within this text node
          offset += range.startOffset;
          break;
        }
        // Add length of this text node (including all characters)
        offset += node.textContent?.length || 0;
      }
      
      return offset;
    };

    // Handle input
    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      if (isComposingRef.current) return;
      
      const element = e.currentTarget;
      
      // Get current text content BEFORE any DOM changes
      const currentText = getTextContent(element);
      const newIsEmpty = !currentText || currentText.length === 0;
      setIsEmpty(newIsEmpty);
      
      // Save cursor position BEFORE rebuilding (based on current DOM)
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const cursorOffset = range ? getCursorOffsetFromText(element, range) : currentText.length;
      
      // Enforce maxLength
      if (maxLength && currentText.length > maxLength) {
        const truncated = currentText.substring(0, maxLength);
        isInternalChangeRef.current = true;
        buildStyledContent(element, truncated);
        onChange(truncated);
        setIsEmpty(truncated.length === 0);
        isInternalChangeRef.current = false;
        
        // Restore cursor at end of truncated text
        requestAnimationFrame(() => {
          restoreCursorPosition(element, Math.min(cursorOffset, truncated.length));
        });
        return;
      }
      
      // Always rebuild to ensure mentions are styled
      isInternalChangeRef.current = true;
      buildStyledContent(element, currentText);
      onChange(currentText);
      isInternalChangeRef.current = false;
      
      // Restore cursor position after rebuilding
      // Use the saved offset which is based on plain text, so it should match after rebuild
      // Ensure offset doesn't exceed text length
      const safeOffset = Math.min(cursorOffset, currentText.length);
      requestAnimationFrame(() => {
        restoreCursorPosition(element, safeOffset);
      });
    };
    
    // Handle focus
    const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      setIsFocused(true);
      onFocus?.();
    };
    
    // Handle blur
    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      setIsFocused(false);
      onBlur?.();
    };

    // Handle composition (for IME input)
    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
      isComposingRef.current = false;
      handleInput(e as any);
    };

    // Sync value prop to content and rebuild styled structure
    useEffect(() => {
      // Skip if change came from internal user input
      if (isInternalChangeRef.current) return;
      
      const element = contentEditableRef.current;
      if (!element) return;

      const currentText = getTextContent(element);
      const newIsEmpty = !value || value.trim().length === 0;
      setIsEmpty(newIsEmpty);
      
      // Only update if value changed externally (not from user input)
      if (currentText !== value) {
        // Save cursor position
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        let cursorOffset = 0;
        
        if (range) {
          // Calculate offset within the entire text content
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
          );
          let offset = 0;
          let node;
          while ((node = walker.nextNode())) {
            if (node === range.startContainer) {
              cursorOffset = offset + range.startOffset;
              break;
            }
            offset += node.textContent?.length || 0;
          }
        }

        // Rebuild styled content
        buildStyledContent(element, value || '');

        // Restore cursor position
        if (cursorOffset > 0 && cursorOffset <= (value?.length || 0)) {
          setTimeout(() => {
            restoreCursorPosition(element, cursorOffset);
          }, 0);
        }
      }
    }, [value, mentionColor]);

    // Auto focus
    useEffect(() => {
      if (autoFocus && contentEditableRef.current) {
        contentEditableRef.current.focus();
      }
    }, [autoFocus]);

    // Initialize content on mount
    useEffect(() => {
      const element = contentEditableRef.current;
      if (element) {
        const currentText = getTextContent(element);
        if (value && value.trim().length > 0) {
          buildStyledContent(element, value);
        } else {
          // Ensure empty state - contenteditable handles this naturally
          element.textContent = '';
        }
      }
    }, []);

    // Sync placeholder positioning with contenteditable
    useEffect(() => {
      const element = contentEditableRef.current;
      const placeholderEl = placeholderRef.current;
      if (!element || !placeholderEl) return;

      // Match computed styles exactly
      const computedStyle = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      // Match all visual properties
      placeholderEl.style.paddingTop = computedStyle.paddingTop;
      placeholderEl.style.paddingRight = computedStyle.paddingRight;
      placeholderEl.style.paddingBottom = computedStyle.paddingBottom;
      placeholderEl.style.paddingLeft = computedStyle.paddingLeft;
      placeholderEl.style.lineHeight = computedStyle.lineHeight;
      placeholderEl.style.fontSize = computedStyle.fontSize;
      placeholderEl.style.fontFamily = computedStyle.fontFamily;
      placeholderEl.style.fontWeight = computedStyle.fontWeight;
      placeholderEl.style.letterSpacing = computedStyle.letterSpacing;
      placeholderEl.style.wordSpacing = computedStyle.wordSpacing;
      placeholderEl.style.textAlign = computedStyle.textAlign;
      placeholderEl.style.whiteSpace = computedStyle.whiteSpace;
      
      // Ensure placeholder matches the contenteditable's box model
      placeholderEl.style.boxSizing = computedStyle.boxSizing;
      placeholderEl.style.width = computedStyle.width;
      placeholderEl.style.height = computedStyle.height;
      placeholderEl.style.minHeight = computedStyle.minHeight;
    }, [isEmpty, isFocused, value, style, className]);

    // Extract placeholder color from className or use default
    const getPlaceholderColor = () => {
      // Check if className has explicit placeholder color classes
      if (className.includes('placeholder:text-gray-400')) return 'text-gray-400';
      if (className.includes('placeholder:text-gray-500')) return 'text-gray-500';
      if (className.includes('placeholder:text-red-200')) return 'text-red-200';
      if (className.includes('placeholder:text-blue-200')) return 'text-blue-200';
      
      // Check background colors for appropriate placeholder
      if (className.includes('bg-black')) {
        return 'text-white/60';
      }
      if (className.includes('bg-red-600')) {
        return 'text-red-200';
      }
      if (className.includes('bg-blue-600')) {
        return 'text-blue-200';
      }
      
      // Check text color to infer placeholder
      if (className.includes('text-white')) {
        return 'text-white/60';
      }
      
      // Default for light backgrounds
      return 'text-gray-500';
    };

    // Show placeholder when empty and not actively typing
    const showPlaceholder = isEmpty && placeholder;

    return (
      <div className="relative">
        <div
          ref={contentEditableRef}
          contentEditable
          onInput={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={className}
          style={{
            ...style,
            // Ensure consistent styling when empty
            minHeight: isEmpty ? style?.minHeight || 'auto' : style?.minHeight,
          }}
          suppressContentEditableWarning
          data-placeholder={placeholder}
        />
        {showPlaceholder && (
          <div
            ref={placeholderRef}
            className={`absolute inset-0 pointer-events-none ${getPlaceholderColor()}`}
            style={{
              display: 'block',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {placeholder}
          </div>
        )}
      </div>
    );
  }
);

MentionTextarea.displayName = 'MentionTextarea';

export default MentionTextarea;
