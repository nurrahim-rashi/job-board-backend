type EmailInput = { to: string; subject: string; text: string };

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
    if (!isProduction) printEmailPreview(input);
    return;
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
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
    if (isProduction) throw new Error("Unable to deliver email");
    console.warn(
      `Resend rejected the email (${response.status}); using local email preview. ${details}`,
    );
    printEmailPreview(input);
  }
}
