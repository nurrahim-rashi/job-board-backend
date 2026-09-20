import { describe, expect, it } from "vitest";
import { buildPolarisEmail, escapeEmailHtml } from "../services/email-template.service.js";

describe("Polaris email template", () => {
  it("renders a branded call to action and escapes dynamic content", () => {
    const html = buildPolarisEmail({
      preheader: "Account update",
      eyebrow: "Security",
      title: "Hello <script>alert(1)</script>",
      message: "Use the secure link below.",
      details: [{ label: "Company", value: "A&B <Team>" }],
      action: { label: "Continue", url: "https://example.com/?a=1&b=2" },
    });

    expect(html).toContain("✦ Polaris");
    expect(html).toContain("Hello &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("A&amp;B &lt;Team&gt;");
    expect(html).toContain("https://example.com/?a=1&amp;b=2");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes quotes used inside attributes", () => {
    expect(escapeEmailHtml(`\"'&<>`)).toBe("&quot;&#039;&amp;&lt;&gt;");
  });
});
