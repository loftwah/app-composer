---
layout: "../../layouts/Article.astro"
title: "Why we built App Composer Spin"
description: "A wheel for the everyday decisions that go round in circles, with a replay your friends can check."
cover: "/campaign/spin/spin-wide-20261127d.jpg"
coverAlt: "Takeaway roulette. An orange, cream and navy wheel beside a paper takeaway bag and hot chips."
coverCaption: "Original AI-generated campaign artwork for App Composer Spin."
published: "2026-11-27"
---

Dinner is the decision that keeps coming back. The group is hungry, nobody wants to pick, and the same three places get suggested. We built [App Composer Spin](https://spin.loftwah.com/) so anyone can put the choices on a wheel, agree to the rules and get on with the evening.

Start with Australian takeaway roulette for fish and chips, kebabs, an HSP or a burger. Tap a few tastes to get suggestions, turn off anything you’re over, or add your local favourite. Spin remembers the wheel on your device. There are also presets for game night, weekend plans, chores and who goes first. The wheel works in your browser without an account.

## What your friends can check

1. Lock the wheel. Spin records the ordered choices and series rules, and returns a short commitment derived from the configuration and a random server seed.
2. Share the session link before spinning if your friends want to witness the commitment. Each round is derived from that fixed seed, the configuration hash and the round number, using HMAC-SHA-256 and rejection sampling for equal odds among the eligible choices.
3. Open the replay when the series finishes. Spin reveals the seed, and the recipient’s browser recomputes the commitment, rounds and tally. They can download the JSON receipt to keep or verify separately.

With two choices, best of three ends when one gets two wins. With more choices, the wheel counts three spins and runs a tie-break among the leaders when needed. A rematch or an editable copy starts a new commitment. The original stays available to the people holding its link for 30 days.

The receipt checks consistency within one session. A person can still create several separate sessions and only share the one they like. A commitment also relies on the operator choosing a genuinely random server seed. The replay link and receipt are what people can use to verify a result. A screenshot or exported clip is a copy to share.

## Watch a real result

[Australian takeaway replay](https://spin.loftwah.com/?example=takeaway) · [Game night replay](https://spin.loftwah.com/?example=game-night) · [Heads or tails replay](https://spin.loftwah.com/?example=coin)

These public launch examples preserve the original completed receipts so you can replay and verify them after the original session links expire.

<figure>
  <video controls playsinline preload="metadata" width="540" height="960" poster="/campaign/spin/wheel-demo-poster-20261127d.webp" src="/campaign/spin/wheel-demo-20261127d.mp4">
    <track kind="captions" label="English" srclang="en" src="/campaign/spin/wheel-demo-20261127d.en.vtt" default>
  </video>
  <figcaption>A phone-sized recording of Spin’s takeaway suggestions, wheel sound and result link. <a href="/share/spin">Watch it in App Composer Share</a>.</figcaption>
</figure>

## If the wheel picks takeaway

Set a suburb or postcode such as Sunbury VIC 3429. Spin remembers the area on your device. When a recognised takeaway choice wins, use the Maps link to look for a shop. The wheel’s labels are decision options. Check locations, opening hours and menus in the map listing.

[Open Spin and make a wheel](https://spin.loftwah.com/) · [Browse more App Composer mini-apps](/apps)

## Spin brand assets

[Logo for dark backgrounds](/spin-brand/spin-lockup-dark-20261127c.png) · [Logo for light backgrounds](/spin-brand/spin-lockup-light-20261127c.png) · [App icon](/spin-brand/spin-icon-512-20261127d.png) · [Social preview](/campaign/spin/spin-wide-20261127d.jpg) · [Launch kit and QR](/share/spin#social-kit)
