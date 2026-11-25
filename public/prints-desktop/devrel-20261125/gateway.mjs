// One optional caption request against the attendee's own Cloudflare account.
const flags = process.argv.slice(2);
if (flags.length !== 1 || flags[0] !== '--live') {
  console.log('Dry run. Add --live to make one potentially billable request.');
  process.exit(0);
}

const { CF_ACCOUNT_ID, CF_AI_GATEWAY_ID, CLOUDFLARE_API_TOKEN, CF_MODEL } = process.env;
if (!/^[a-f0-9]{32}$/i.test(CF_ACCOUNT_ID ?? '')
  || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(CF_AI_GATEWAY_ID ?? '')
  || !CLOUDFLARE_API_TOKEN
  || !/^@cf\/[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(CF_MODEL ?? '')) {
  console.error('Set CF_ACCOUNT_ID, CF_AI_GATEWAY_ID, CLOUDFLARE_API_TOKEN and a current @cf/ text model in CF_MODEL.');
  process.exit(1);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/v1/chat/completions`;
try {
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'cf-aig-gateway-id': CF_AI_GATEWAY_ID,
      'cf-aig-skip-cache': 'true',
      'cf-aig-max-attempts': '1',
    },
    body: JSON.stringify({
      model: CF_MODEL,
      messages: [{ role: 'user', content: 'Write one playful caption under 100 characters for a fictional pop-up called Midnight Arcade. Reply with the caption only.' }],
      max_tokens: 80,
    }),
  });
  if (!response.ok) {
    console.error(`Cloudflare returned HTTP ${response.status}. Check the account, gateway, token and model. This script does not retry.`);
    process.exitCode = 1;
  } else {
    const result = await response.json();
    const caption = result.choices?.[0]?.message?.content;
    if (typeof caption !== 'string' || !caption.trim()) throw new Error('No caption in response.');
    console.log(JSON.stringify({
      mode: 'live',
      model: CF_MODEL,
      caption: caption.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 280),
      usage: result.usage ?? null,
    }, null, 2));
  }
} catch {
  console.error('The request did not return a usable caption. Check Analytics and Logs in your gateway before trying again.');
  process.exitCode = 1;
}
