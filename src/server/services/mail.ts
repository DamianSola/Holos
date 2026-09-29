import nodemailer from "nodemailer";

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV !== "production") console.info(`[holos mail] ${input.subject} -> ${input.to}\n${input.text}`);
    else console.error("[holos mail] SMTP is not configured");
    return false;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    attachments: input.attachments,
  });
  return true;
}
