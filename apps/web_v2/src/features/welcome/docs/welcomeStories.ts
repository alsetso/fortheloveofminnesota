/**
 * Welcome story cards — voice from docs/brand-language.md
 * Plain, direct, product-driven. Stand · Work · Share.
 */

export type StorySection = {
  heading?: string;
  body: string;
};

export type WelcomeStory = {
  id: string;
  title: string;
  summary: string;
  sheetTitle: string;
  sections: StorySection[];
  ask: string;
  showTools?: boolean;
};

export const WELCOME_DOC_TOPICS: WelcomeStory[] = [
  {
    id: 'stand-together',
    title: 'Stand together',
    summary: 'Share what you love. Know your block.',
    sheetTitle: 'Stand together',
    ask: 'Know your block. Check in on a neighbor.',
    sections: [
      {
        body: 'Share what you love about where you live. Your town. Your people. The places that matter to you.',
      },
      {
        heading: 'Know your block',
        body: 'See who’s around you. Learn the streets, the schools, the names next door. Standing together starts with knowing your block.',
      },
      {
        heading: 'Check in on neighbors',
        body: 'Don’t wait for a crisis. Check in. Pass along what helps. That’s how Minnesota stays close.',
      },
    ],
  },
  {
    id: 'work-together',
    title: 'Work together',
    summary: 'Connect locally. Show up.',
    sheetTitle: 'Work together',
    ask: 'Find your local meeting. Show up.',
    sections: [
      {
        body: 'Share your services. Offer what you can. Ask for what you need. Work gets done when neighbors connect locally.',
      },
      {
        heading: 'Use the tools to connect',
        body: 'The map, people, and places tools are here so you can find each other — and get to the right room without guessing.',
      },
      {
        heading: 'Find your meetings',
        body: 'City, county, school, district. Find your local meetings. Then show up. That’s the work.',
      },
    ],
  },
  {
    id: 'share-resources',
    title: 'Share resources',
    summary: 'Tools to connect, meet, and congregate.',
    sheetTitle: 'Share resources',
    ask: 'Use the tools. Bring someone with you.',
    showTools: true,
    sections: [
      {
        body: 'These are tools to connect — so you can congregate, meet, and pass along what’s useful.',
      },
      {
        heading: 'What you can share',
        body: 'Search, Find me, Boundaries, People, Addresses, routes. Clear names. Built to hand on to a neighbor, not sit unused.',
      },
      {
        heading: 'Keep it moving',
        body: 'If a tool helps you meet, gather, or get oriented — send it to someone who needs the same. Shared resources make stronger blocks.',
      },
    ],
  },
];
