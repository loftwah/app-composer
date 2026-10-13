// One fixed transport; no public route, arbitrary host or automatic retry loop.
export async function deliverResend(message, runtime, send = fetch) {
  const key = runtime.RESEND_API_KEY;
  const from = runtime.RESEND_FROM_ADDRESS;
  const allowed = (runtime.RESEND_ALLOWED_RECIPIENTS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const address = /^[^\s<>@,]+@[^\s<>@,]+\.[^\s<>@,]+$/;
  if (!key || !address.test(from || '') || allowed.length === 0) throw new Error('Composer email is not configured.');
  const recipients = [message.to, ...(message.cc || [])];
  if (recipients.some(value => !address.test(value) || !allowed.includes(value.toLowerCase()))) throw new Error('Composer email recipient is not invited.');
  if (message.replyTo && !address.test(message.replyTo)) throw new Error('Composer email reply address is invalid.');
  const response = await send('https://api.resend.com/emails', {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
    headers: {'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `composer-${crypto.randomUUID()}`},
    body: JSON.stringify({from, to: [message.to], ...(message.cc?.length ? {cc: message.cc} : {}), ...(message.replyTo ? {reply_to: message.replyTo} : {}), subject: message.subject, text: message.text, ...(message.html ? {html: message.html} : {})}),
  });
  // Provider response bodies can contain addresses or message content; never expose them.
  if (!response.ok) throw new Error(`Composer email delivery failed (${response.status}).`);
}
