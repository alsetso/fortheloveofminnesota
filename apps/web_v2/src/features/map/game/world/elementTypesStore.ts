/** Runtime world.element_types registry — hydrated from /api/world/element-types. */

import {
  ELEMENT_TYPE_FALLBACKS,
  buildColorMap,
  type ElementType,
} from '@/features/map/game/world/elementTypes';

type Listener = () => void;

let types: ElementType[] = ELEMENT_TYPE_FALLBACKS;
let colorMap: Record<string, string> = buildColorMap(types);
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getElementTypes(): ElementType[] {
  return types;
}

export function getElementTypeColorMap(): Record<string, string> {
  return colorMap;
}

export function subscribeElementTypes(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setElementTypes(next: ElementType[]): void {
  if (!Array.isArray(next) || next.length === 0) return;
  types = next;
  colorMap = buildColorMap(next);
  emit();
}
