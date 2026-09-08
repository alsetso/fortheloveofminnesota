/** Open state for the community post detail card tapped from a world placement. */

type Listener = () => void;

export type PostDetailCardState = {
  postId: string;
} | null;

let state: PostDetailCardState = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getPostDetailCardState(): PostDetailCardState {
  return state;
}

export function subscribePostDetailCard(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openPostDetailCard(postId: string): void {
  state = { postId };
  emit();
}

export function closePostDetailCard(): void {
  if (state == null) return;
  state = null;
  emit();
}
