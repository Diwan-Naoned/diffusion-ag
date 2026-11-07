/** Changes on every start, so a deploy busts cached CSS/JS (they are served with a 1-day max-age). */
const ASSET_VERSION = Date.now().toString(36);

export function assetUrl(path: string): string {
  return `${path}?v=${ASSET_VERSION}`;
}
