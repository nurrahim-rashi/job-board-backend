type EmailDetail = {
  label: string;
  value: string;
  url?: string;
};

type EmailTemplateInput = {
  preheader: string;
  eyebrow?: string;
  title: string;
  greeting?: string;
  message: string;
  details?: EmailDetail[];
  action?: { label: string; url: string };
  note?: string;
};

export const escapeEmailHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const lineBreaks = (value: string) => escapeEmailHtml(value).replaceAll("\n", "<br>");

export function buildPolarisEmail(input: EmailTemplateInput) {
  const details = input.details?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border:1px solid #ded9cf;border-radius:16px;background:#f8f5ed;border-collapse:separate;overflow:hidden;">
        ${input.details
          .map(
            (detail, index) => `<tr>
              <td style="padding:14px 16px;${index ? "border-top:1px solid #ded9cf;" : ""}color:#74717a;font-size:12px;line-height:1.4;width:34%;vertical-align:top;">${escapeEmailHtml(detail.label)}</td>
              <td style="padding:14px 16px;${index ? "border-top:1px solid #ded9cf;" : ""}color:#202129;font-size:14px;font-weight:700;line-height:1.5;vertical-align:top;overflow-wrap:anywhere;">${detail.url ? `<a href="${escapeEmailHtml(detail.url)}" style="color:#485eb4;text-decoration:none;">${lineBreaks(detail.value)}</a>` : lineBreaks(detail.value)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";
  const action = input.action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 6px;"><tr><td style="border-radius:999px;background:#485eb4;"><a href="${escapeEmailHtml(input.action.url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${escapeEmailHtml(input.action.label)}</a></td></tr></table>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#f1eee7;color:#202129;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeEmailHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1eee7;"><tr><td align="center" style="padding:32px 14px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:separate;">
      <tr><td style="padding:0 8px 18px;color:#172443;font-family:Georgia,serif;font-size:25px;letter-spacing:-.5px;">✦ Polaris</td></tr>
      <tr><td style="border:1px solid #ded9cf;border-radius:24px;background:#fffdf7;padding:38px 40px;box-shadow:0 16px 40px rgba(31,32,45,.08);">
        ${input.eyebrow ? `<div style="margin-bottom:14px;color:#485eb4;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">${escapeEmailHtml(input.eyebrow)}</div>` : ""}
        <h1 style="margin:0 0 18px;color:#202129;font-family:Georgia,serif;font-size:34px;font-weight:400;line-height:1.12;letter-spacing:-1px;">${escapeEmailHtml(input.title)}</h1>
        ${input.greeting ? `<p style="margin:0 0 12px;color:#202129;font-size:15px;line-height:1.65;">${escapeEmailHtml(input.greeting)}</p>` : ""}
        <p style="margin:0;color:#67656c;font-size:15px;line-height:1.7;">${lineBreaks(input.message)}</p>
        ${details}${action}
        ${input.note ? `<p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #e6e1d7;color:#8a878d;font-size:12px;line-height:1.55;">${lineBreaks(input.note)}</p>` : ""}
      </td></tr>
      <tr><td style="padding:18px 8px 0;color:#8a878d;font-size:11px;line-height:1.55;text-align:center;">This message was sent by Polaris. Please do not share secure links from this email.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
