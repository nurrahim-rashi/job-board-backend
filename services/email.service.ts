import { ApiError } from "../utils/api-error.js";

type EmailInput = { to: string; subject: string; text: string; html?: string };

function printEmailPreview(input: EmailInput) {
  console.info(
    `[email preview] ${input.to}\n${input.subject}\n${input.text}`,
  );
}

export async function sendEmail(input: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const isProduction = process.env.NODE_ENV === "production";

  if (!apiKey || !from) {
    if (isProduction) {
      const missing = [
        !apiKey ? "RESEND_API_KEY" : null,
        !from ? "EMAIL_FROM" : null,
      ].filter(Boolean).join(" and ");
      console.error(`Email delivery is not configured: missing ${missing}`);
      throw new ApiError("Email delivery is temporarily unavailable", 503);
    }
    printEmailPreview(input);
    return;
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });
  } catch (error) {
    if (isProduction) throw error;
    console.warn("Resend request failed; using local email preview.");
    printEmailPreview(input);
    return;
  }

  if (!response.ok) {
    const details = await response.text();
    if (isProduction) {
      console.error(`Resend rejected the email (${response.status}): ${details}`);
      throw new ApiError("Email provider rejected the message", 502);
    }
    console.warn(
      `Resend rejected the email (${response.status}); using local email preview. ${details}`,
    );
    printEmailPreview(input);
    return;
  }

  const result = (await response.json().catch(() => null)) as
    | { id?: string }
    | null;
  console.info(
    `Email accepted by Resend${result?.id ? ` (${result.id})` : ""}: ${input.subject}`,
  );
}
