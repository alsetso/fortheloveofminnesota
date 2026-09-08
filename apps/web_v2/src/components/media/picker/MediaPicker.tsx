'use client';

import { useId, type ChangeEvent, type Ref } from 'react';

export type MediaPickerProps = {
  /** Forwarded to the native file input (PHPicker in Despia). */
  inputRef?: Ref<HTMLInputElement>;
  /** Called with the selected FileList (may be empty after cancel). */
  onFiles: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  id?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Native photo/video picker only — `<input type="file">` routes to iOS PHPicker
 * inside Despia. Do not replace with a custom library UI.
 */
export default function MediaPicker({
  inputRef,
  onFiles,
  accept = 'image/*,video/*',
  multiple = true,
  id,
  disabled,
  className = 'sr-only',
}: MediaPickerProps) {
  const autoId = useId();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files);
    // Allow re-selecting the same asset.
    e.target.value = '';
  };

  return (
    <input
      id={id ?? autoId}
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      className={className}
      onChange={onChange}
    />
  );
}
