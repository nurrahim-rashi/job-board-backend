import sanitizeHtml from "sanitize-html";

// Matches the marks the company profile rich-text editor can actually produce
// (web/src/components/site/RichTextEditor.tsx). Anything else — script, style,
// iframe, images, inline styles, event handlers — is stripped rather than
// escaped, so a direct API call can't smuggle in markup the editor never offers.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
];

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      }),
    },
  }).trim();
}
