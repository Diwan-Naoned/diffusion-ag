const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts a YouTube video id from what a Bureau member pastes: the id itself, or a watch,
 * live, embed, shorts or youtu.be URL. Returns null for an empty value, undefined if unrecognized.
 */
export function parseYoutubeId(input: string): string | null | undefined {
  const value = input.trim();
  if (!value) return null;
  if (ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return undefined;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  let candidate: string | undefined;
  if (host === 'youtu.be') candidate = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    candidate = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:live|embed|shorts|v)\/([^/?#]+)/)?.[1];
  }
  return candidate && ID.test(candidate) ? candidate : undefined;
}
