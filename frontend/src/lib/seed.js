// Seed / mock data so the UI is never empty on first load.

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const now = Date.now();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Pre-populated first conversation, with an already-approved plan.
export const initialMessages = [
  {
    id: uid(),
    role: "user",
    text: "Schedule a team meeting for tomorrow at 3pm with the design team",
    timestamp: now - 6 * 60 * 1000,
  },
  {
    id: uid(),
    role: "assistant",
    text: "Done! I've carried out your plan.",
    status: "completed",
    plan: [
      {
        id: uid(),
        description: "Check your calendar for conflicts at 3pm tomorrow",
        action_type: "schedule",
      },
      {
        id: uid(),
        description: 'Create a meeting invite titled "Design Team Sync"',
        action_type: "schedule",
      },
      {
        id: uid(),
        description: "Send invites to the design team members",
        action_type: "message",
      },
    ],
    timestamp: now - 5 * 60 * 1000,
  },
];

export const initialMemories = [
  {
    id: uid(),
    content: "Prefers meetings scheduled in the afternoon, not before 11am.",
    createdAt: now - 3 * DAY,
  },
  {
    id: uid(),
    content: "Works on the design team alongside Priya, Marcus and Lena.",
    createdAt: now - 2 * DAY,
  },
  {
    id: uid(),
    content: "Calls mum every Friday - likes a reminder at 6pm.",
    createdAt: now - 18 * HOUR,
  },
];

export const initialSessions = [
  {
    id: uid(),
    title: "Schedule a team meeting for tomorrow at 3pm",
    createdAt: now - 2 * HOUR,
    messages: initialMessages,
  },
  {
    id: uid(),
    title: "Remind me to renew my passport next month",
    createdAt: now - DAY - 4 * HOUR,
    messages: [
      {
        id: uid(),
        role: "user",
        text: "Remind me to renew my passport next month",
        timestamp: now - DAY - 4 * HOUR,
      },
      {
        id: uid(),
        role: "assistant",
        text: "Done! I've carried out your plan.",
        status: "completed",
        plan: [
          {
            id: uid(),
            description: 'Create a reminder titled "Renew passport"',
            action_type: "remind",
          },
          {
            id: uid(),
            description: "Schedule a notification for the 1st of next month",
            action_type: "remind",
          },
        ],
        timestamp: now - DAY - 4 * HOUR + 30000,
      },
    ],
  },
  {
    id: uid(),
    title: "Search for the latest news on AI agents",
    createdAt: now - 5 * DAY,
    messages: [
      {
        id: uid(),
        role: "user",
        text: "Search for the latest news on AI agents",
        timestamp: now - 5 * DAY,
      },
      {
        id: uid(),
        role: "assistant",
        text: "Done! I've carried out your plan.",
        status: "completed",
        plan: [
          {
            id: uid(),
            description: "Search the web for the latest news on AI agents",
            action_type: "search",
          },
          {
            id: uid(),
            description: "Summarise the top 5 results for you",
            action_type: "search",
          },
        ],
        timestamp: now - 5 * DAY + 40000,
      },
    ],
  },
];
