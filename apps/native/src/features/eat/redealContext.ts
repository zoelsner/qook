// Build the context string for a re-dealt hand: the user's voice context, a
// compact swipe summary (kept/passed by cuisine — steers toward keeps, away
// from passes), and an exclusion list of titles already dealt this session.
// TITLES ONLY, never full recipes (token-cheap, spec §1.1.5/§1.1.9). Voice
// context leads and is only truncated when it alone exceeds the cap (client
// input is capped at 240 chars, so that path is defensive); steering +
// exclusions are trimmed to fit the server's 500-char `context` ceiling.
// Pure — bun-testable.
export const REDEAL_CONTEXT_MAX = 500;

export function buildRedealContext(input: {
  voiceContext: string;
  summary: { keptTitles: string[]; keptCuisines: string[]; passedCuisines: string[] };
  excludeTitles: string[];
}): string {
  const { voiceContext, summary, excludeTitles } = input;
  // Cap the head itself so an oversized voice context can't push the final
  // slice into chopping a joined section mid-way.
  const head = voiceContext.trim().slice(0, REDEAL_CONTEXT_MAX);

  const steer: string[] = [];
  if (summary.keptCuisines.length) steer.push(`More like: ${summary.keptCuisines.join(', ')}.`);
  if (summary.passedCuisines.length) steer.push(`Avoid more: ${summary.passedCuisines.join(', ')}.`);

  const parts: string[] = [];
  if (head) parts.push(head);
  if (steer.length) parts.push(steer.join(' '));

  // Add exclusion titles greedily until we'd exceed the cap.
  const prefix = parts.join('\n\n');
  const excludeLead = "Don't repeat these dishes: ";
  const kept: string[] = [];
  let running = prefix.length + (prefix ? 2 : 0) + excludeLead.length; // +2 for the joining "\n\n"
  for (const title of excludeTitles) {
    const add = (kept.length ? 2 : 0) + title.length; // ", " separator
    if (running + add + 1 > REDEAL_CONTEXT_MAX) break; // +1 for trailing "."
    kept.push(title);
    running += add;
  }
  if (kept.length) parts.push(`${excludeLead}${kept.join(', ')}.`);

  return parts.join('\n\n').slice(0, REDEAL_CONTEXT_MAX);
}
