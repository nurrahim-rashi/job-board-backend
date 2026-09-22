import { describe, expect, it } from "vitest";

import { sanitizeRichText } from "../lib/sanitize-html.js";

describe("sanitizeRichText", () => {
  it("keeps the formatting the editor offers", () => {
    const input =
      "<p>Hello <strong>world</strong>, <em>welcome</em> to <s>Polaris</s> <u>Inc</u>.</p>" +
      "<h2>Our mission</h2><h3>Our values</h3>" +
      "<ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>" +
      "<blockquote>We build things.</blockquote>";

    expect(sanitizeRichText(input)).toBe(input);
  });

  it("strips script tags and their content", () => {
    const output = sanitizeRichText(
      "<p>Hi</p><script>alert('xss')</script><p>Bye</p>",
    );

    expect(output).not.toContain("script");
    expect(output).not.toContain("alert");
    expect(output).toBe("<p>Hi</p><p>Bye</p>");
  });

  it("strips event handler attributes", () => {
    const output = sanitizeRichText(
      '<p onclick="steal()">Click me</p><strong onmouseover="steal()">hover</strong>',
    );

    expect(output).not.toContain("onclick");
    expect(output).not.toContain("onmouseover");
    expect(output).toContain("Click me");
  });

  it("drops disallowed tags but keeps their text", () => {
    const output = sanitizeRichText(
      "<h1>Too big</h1><img src=\"x\" onerror=\"steal()\"><iframe src=\"evil\"></iframe><p>Kept</p>",
    );

    expect(output).not.toContain("<h1");
    expect(output).not.toContain("<img");
    expect(output).not.toContain("<iframe");
    expect(output).toContain("Too big");
    expect(output).toContain("<p>Kept</p>");
  });

  it("refuses javascript: and data: link schemes", () => {
    const output = sanitizeRichText(
      '<a href="javascript:alert(1)">click</a><a href="data:text/html,evil">click</a>',
    );

    expect(output).not.toContain("javascript:");
    expect(output).not.toContain("data:");
    expect(output).not.toContain("href");
  });

  it("keeps http(s) and mailto links, forcing safe target and rel", () => {
    const output = sanitizeRichText(
      '<a href="https://example.com" class="tracked">site</a>' +
        '<a href="mailto:hi@example.com">email</a>',
    );

    expect(output).toContain('href="https://example.com"');
    expect(output).toContain('target="_blank"');
    expect(output).toContain('rel="noopener noreferrer nofollow"');
    expect(output).toContain('href="mailto:hi@example.com"');
    expect(output).not.toContain("class=");
  });

  it("strips inline styles", () => {
    const output = sanitizeRichText(
      '<p style="color:red;position:fixed">Styled</p>',
    );

    expect(output).not.toContain("style=");
    expect(output).toContain("Styled");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeRichText("  <p>Hi</p>  \n")).toBe("<p>Hi</p>");
  });
});
