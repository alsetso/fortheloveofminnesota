/**
 * Pose state for the player avatar.
 *
 * Persisted on public.accounts.pose_state. Frontend always uses the default
 * idle stance — no pose picker UI.
 */
export type AvatarPoseState =
  | 'arms_down'
  | 'right_arm_bent'
  | 'left_arm_bent'
  | 'both_arms_bent';

export const DEFAULT_POSE_STATE: AvatarPoseState = 'arms_down';
