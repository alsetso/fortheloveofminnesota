/**
 * Campaign narrative types.
 * Tables: campaign_chapters, campaign_sentences, account_campaign_progress
 */

export type CampaignSentenceStyle = 'body' | 'em' | 'heading' | 'spacer';

export type CampaignSentence = {
  id: number;
  chapterId: number;
  sortOrder: number;
  style: CampaignSentenceStyle;
  content: string | null;
};

export type CampaignChapter = {
  id: number;
  chapterNum: number;
  title: string;
  subtitle: string | null;
  levelRequired: number;
  territoriesRequired: number;
  collectionsRequired: number;
  sessionsRequired: number;
  homeRequired: boolean;
  published: boolean;
  sentences: CampaignSentence[];
};

export type CampaignProgress = {
  /** sentence ids the account has marked read */
  readSentenceIds: Set<number>;
  /** chapter ids fully read (all non-spacer sentences read) */
  completedChapterIds: Set<number>;
};

export type CampaignChapterWithProgress = CampaignChapter & {
  /** Gate passed for current account */
  unlocked: boolean;
  /** Next unread sentence index (0-based into sentences array) */
  nextSentenceIndex: number;
  /** All readable sentences have been seen */
  complete: boolean;
  /** Gate hint shown when locked */
  lockHint: string | null;
};

export type CampaignPayload = {
  chapters: CampaignChapterWithProgress[];
};
