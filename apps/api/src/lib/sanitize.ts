import sanitizeHtml from "sanitize-html";

// Splash-page HTML is written by organizers but shown to anyone, on Droplet's
// own site. Keep formatting, links, images, tables and video embeds; drop
// anything that can run code or collect input (scripts, event handlers,
// forms, styles that could cover the page), so a pasted snippet can't attack
// visitors or steal their sign-in.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "blockquote", "pre", "code",
    "strong", "b", "em", "i", "u", "s", "small", "mark", "sub", "sup",
    "ul", "ol", "li", "dl", "dt", "dd",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "div", "span", "section", "article", "header", "footer",
    "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    iframe: ["src", "title", "width", "height", "allow", "allowfullscreen"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    ol: ["start", "reversed"],
    // The visual editor marks YouTube embeds this way to recognize them later.
    div: ["data-youtube-video"],
    "*": ["style"],
  },
  // Only harmless styling; nothing that positions content over the page.
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^(none|underline|line-through)$/],
    },
  },
  allowedSchemes: ["https", "http", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"], iframe: ["https"] },
  allowProtocolRelative: false,
  // Video embeds only from these sites.
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  transformTags: {
    // Links open in a new tab and can't control the page that opened them.
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy" }),
  },
};

export const sanitizeSplashHtml = (html: string) => sanitizeHtml(html, OPTIONS).trim();

// Whether the HTML has anything the sanitizer removes for safety (as opposed
// to harmless tidying), so editors can be told.
const UNSAFE = [
  /<\s*(script|style|form|input|button|textarea|select|object|embed|link|meta|base|svg|math)\b/i,
  /\son[a-z]+\s*=/i,
  // In an attribute (href, src…), not ordinary text like "data: 2026".
  /=\s*["']?\s*(javascript|vbscript|data)\s*:/i,
];
const ALLOWED_IFRAME = /^https:\/\/(www\.youtube\.com|www\.youtube-nocookie\.com|player\.vimeo\.com)\//i;

export function hasUnsafeContent(html: string) {
  if (UNSAFE.some((re) => re.test(html))) return true;
  for (const m of html.matchAll(/<\s*iframe\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi)) {
    if (!ALLOWED_IFRAME.test(m[1] ?? "")) return true;
  }
  return false;
}
