# From brief to byte

A public speaker and workshop kit by Loftwah. Go to https://prints.loftwah.com/ and choose Try it.

## Rehearse

1. Open stage.html in a browser. Use left and right arrows or the on-screen controls. Print from your browser for one handout page per scene.
2. Read SPEAKER.md for the talk, the fallback and the audience handoff. ATTENDEE.md gives participants their own checklist.
3. In this folder, run `npx --yes wrangler@4.158.0 dev --local --ip 127.0.0.1 --port 8788`. Use a Node release supported by Wrangler. The first run can download Wrangler.
4. In another terminal run `curl -fsS http://127.0.0.1:8788/api/brief?format=feed` and repeat with `format=link`. You should see a different frame size and caption. Both responses say rehearsal-fixture and zero inference. Press Ctrl+C in the Wrangler terminal when finished.

The Worker runs locally. It has no AI binding and never sends the brief to a provider.

## Make one live Gateway request

Use your own Cloudflare account, an authenticated AI Gateway and an account-scoped token with the relevant run permissions. Use a gateway you created for the lab. Choose an available Workers AI text model from the current catalogue. Open your gateway's settings and check its logs, rate and spend controls before the demo.

Set CF_ACCOUNT_ID, CF_AI_GATEWAY_ID and CF_MODEL in your shell. Put CLOUDFLARE_API_TOKEN in your terminal's private environment. A Cloudflare API token must stay out of the browser, slides, screen shares, source files and chat.

Run `node gateway.mjs` for an offline confirmation. Run `node gateway.mjs --live` to send exactly one potentially billable caption request with the fixed fictional brief. The script skips the cache and performs no retries. In the dashboard, find your gateway's request by timestamp and model. Show the status, duration and usage for this synthetic prompt. Generation, cloud hosting and logging have separate availability and cost footprints. There is no speaker account or token in the bundle.

- Workers AI provider setup https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/
- Authentication https://developers.cloudflare.com/ai-gateway/configuration/authentication/
- Model catalogue https://developers.cloudflare.com/workers-ai/models/
- Logging https://developers.cloudflare.com/ai-gateway/observability/logging/

## Put the route in your own Worker

In an existing Worker with an AI binding named AI and a gateway in the same account, route its call with the gateway option:

```js
await env.AI.run(env.CF_MODEL, {
  messages: [{ role: 'user', content: 'Write one caption for Midnight Arcade.' }],
  max_tokens: 80,
}, { gateway: { id: env.CF_AI_GATEWAY_ID, skipCache: true } });
```

Use the [official binding setup](https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/#workers-binding). Add access control and usage limits to a real endpoint. The included rehearsal Worker serves fixed data locally. Keep it as the fallback during talks.

## Reproduce the image path

At https://prints.loftwah.com/, choose Try it and open the poster workshop for the published Share example, two prior Oyster and Workers AI image receipts, and the pinned local Oyster trial. The images prove historical generation through Prints and Workers AI. They do not establish Gateway routing. Use your own successful live Gateway request to prove that part.

The public Oyster trial runs without a Cloudflare account. Its local Prints app does not generate. An owned Cloudflare Oyster deployment needs Workers Paid and the upstream prerequisite services. Fungi Hub has its own access and funding rules. See the current setup at https://docs.fungi.computer/guides/run-your-own-oyster.

## Reuse

The readme, speaker notes, stage files and demo code are available under the included MIT licence. The illustrated evidence is linked to its source and retains its original credits. Check publication and reuse rights before republishing artwork.
