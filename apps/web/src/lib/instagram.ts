// "https://www.instagram.com/northfield/" -> "@northfield", for display.
export function instagramHandle(url: string) {
  const handle = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  return handle ? `@${handle}` : url;
}
