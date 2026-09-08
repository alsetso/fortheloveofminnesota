/**
 * Stop the native WebView from resizing / repositioning when the keyboard opens.
 * Keep the fixed app shell full-screen so chrome (dock) can stay pinned while
 * the keyboard overlays — `--keyboard-inset` is tracked for optional consumers.
 *
 * @see https://setup.despia.com/native-features/prevent-autoscroll
 */
import { despiaCall, isDespia } from '@/lib/despia/despia';

export async function setDespiaAutoscrollEnabled(enabled: boolean): Promise<void> {
  if (!isDespia()) return;
  await despiaCall(`preventdefault://autoscroll?enabled=${enabled ? 'true' : 'false'}`);
}

/** Disable native keyboard resize once on startup (WebView stays put). */
export async function disableDespiaAutoscroll(): Promise<void> {
  await setDespiaAutoscrollEnabled(false);
}
