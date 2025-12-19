/**
 * Type definitions for pin data
 */

export interface PinData {
  id: string;
  tags?: Array<{ id: string; name: string; [key: string]: unknown }> | { id: string; name: string; [key: string]: unknown } | null;
  media?: unknown;
  [key: string]: unknown;
}





