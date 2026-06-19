// src/lib/api/backends/bluesky/moderation.ts
// Maps the app's free-text report reason onto an AT Protocol moderation
// ReasonType. The ReportSheet sends a label like "Spam" or "Harassment — note",
// so we key off the leading keyword and fall back to reasonOther.

const REASON = 'com.atproto.moderation.defs';

export function reasonTypeFor(reason: string): string {
  const r = reason.toLowerCase();
  if (r.startsWith('spam')) return `${REASON}#reasonSpam`;
  if (r.startsWith('nsfw') || r.startsWith('sexual')) return `${REASON}#reasonSexual`;
  if (r.startsWith('harassment') || r.startsWith('hate') || r.startsWith('rude')) return `${REASON}#reasonRude`;
  if (r.startsWith('misinformation') || r.startsWith('misleading')) return `${REASON}#reasonMisleading`;
  if (r.startsWith('violation')) return `${REASON}#reasonViolation`;
  return `${REASON}#reasonOther`;
}

// Builds the strongRef subject an AT Protocol report needs for a record
// (post or comment — both are app.bsky.feed.post records).
export function recordSubject(uri: string, cid: string) {
  return { $type: 'com.atproto.repo.strongRef', uri, cid };
}

export async function createReport(agent: any, uri: string, cid: string, reason: string): Promise<void> {
  await agent.com.atproto.moderation.createReport({
    reasonType: reasonTypeFor(reason),
    reason,
    subject: recordSubject(uri, cid),
  });
}
