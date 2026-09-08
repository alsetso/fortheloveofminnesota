'use client';

import {
  useCallback,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { CHAT_ATTACHMENT_MAX_COUNT } from '@/lib/ai/chatAttachments';
import {
  enqueueChatAttachments,
  filterChatAttachmentFiles,
  type PendingChatAttachment,
} from '@/features/chat/uploadChatAttachment';

type ChatDropSurfaceProps = {
  children: ReactNode;
  disabled?: boolean;
  threadId?: string | null;
  attachments: PendingChatAttachment[];
  onAttachmentsChange: (next: PendingChatAttachment[]) => void;
  className?: string;
};

function dataTransferHasFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  if (dt.types.includes('Files')) return true;
  return Array.from(dt.items ?? []).some((item) => item.kind === 'file');
}

/**
 * Full-surface drag-and-drop for chat / thread — drops enqueue image/PDF
 * attachments the same way as the composer +.
 */
export default function ChatDropSurface({
  children,
  disabled = false,
  threadId = null,
  attachments,
  onAttachmentsChange,
  className = '',
}: ChatDropSurfaceProps) {
  const [dragging, setDragging] = useState(false);
  const depthRef = useRef(0);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const clearDrag = useCallback(() => {
    depthRef.current = 0;
    setDragging(false);
  }, []);

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    depthRef.current += 1;
    setDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setDragging(false);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !dataTransferHasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    clearDrag();

    const files = filterChatAttachmentFiles(
      Array.from(e.dataTransfer.files ?? []),
    );
    if (files.length === 0) return;
    if (attachmentsRef.current.length >= CHAT_ATTACHMENT_MAX_COUNT) return;

    void enqueueChatAttachments({
      files,
      current: attachmentsRef.current,
      threadId,
      onChange: onAttachmentsChange,
    });
  };

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col ${className}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}

      {dragging ? (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#f7f5f1]/88 backdrop-blur-[2px]"
          aria-hidden
        >
          <div className="mx-6 max-w-sm rounded-[28px] border border-dashed border-black/20 bg-white/90 px-8 py-10 text-center shadow-lg">
            <p className="text-[18px] font-semibold tracking-tight text-foreground">
              Drop to attach
            </p>
            <p className="mt-1.5 text-[14px] text-foreground-muted">
              Images or PDFs · up to {CHAT_ATTACHMENT_MAX_COUNT} files
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
