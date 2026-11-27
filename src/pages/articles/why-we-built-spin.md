---
layout: "../../layouts/Article.astro"
title: "Why we built App Composer Spin"
description: "A wheel for the everyday decisions that go round in circles, with a replay your friends can check."
cover: "/spin-brand/decision-wheel-20261127b.jpg"
coverAlt: "A colourful decision wheel with fish and chips, a game controller and a cup of coffee."
coverCaption: "Original AI-generated illustration for App Composer Spin. The title and lettering were added separately."
published: "2026-11-27"
---

Dinner is the decision that keeps coming back. The group is hungry, nobody wants to pick, and the same three places get suggested. We built [App Composer Spin](https://spin.loftwah.com/) so anyone can put the choices on a wheel, agree to the rules and get on with the evening.

Start with Australian takeaway roulette for fish and chips, kebabs, an HSP or a burger. Turn off anything you’re over, add your local favourite and save the wheel on your device. There are also presets for game night, weekend plans, chores and who goes first. The wheel works in your browser without an account.

## What your friends can check

1. Lock the wheel. Spin records the ordered choices and series rules, and returns a short commitment derived from the configuration and a random server seed.
2. Share the session link before spinning if your friends want to witness the commitment. Each round is derived from that fixed seed, the configuration hash and the round number, using HMAC-SHA-256 and rejection sampling for equal odds among the eligible choices.
3. Open the replay when the series finishes. Spin reveals the seed, and the recipient’s browser recomputes the commitment, rounds and tally. They can download the JSON receipt to keep or verify separately.

With two choices, best of three ends when one gets two wins. With more choices, the wheel counts three spins and runs a tie-break among the leaders when needed. A rematch or an editable copy starts a new commitment. The original stays available to the people holding its link for 30 days.

The receipt checks consistency within one session. A person can still create several separate sessions and only share the one they like. A commitment also relies on the operator choosing a genuinely random server seed. The replay link and receipt are what people can use to verify a result. A screenshot or exported clip is a copy to share.

## Watch a real result

[Australian takeaway replay](https://spin.loftwah.com/?example=takeaway) · [Game night replay](https://spin.loftwah.com/?example=game-night) · [Heads or tails replay](https://spin.loftwah.com/?example=coin)

The three public launch examples preserve the original completed receipts so you can replay and verify them after the original session links expire.

<figure>
  <video controls playsinline preload="metadata" width="1080" height="1920" poster="/spin-brand/demo/takeaway-demo-poster-20261127.webp" src="/spin-brand/demo/takeaway-demo-20261127.mp4">
    <track kind="captions" label="English" srclang="en" src="/spin-brand/demo/takeaway-demo.en.vtt" default>
  </video>
  <figcaption>A short screen recording from Spin, showing an Australian takeaway wheel and the recorded pizza result. <a href="/spin-brand/demo/takeaway-demo-20261127.mp4" download>Download the MP4</a>.</figcaption>
</figure>

## If the wheel picks takeaway

Set a suburb or postcode such as Sunbury VIC 3429. Spin remembers the area on your device. When a recognised takeaway choice wins, use the Maps link to look for a shop. The wheel’s labels are decision options. Check locations, opening hours and menus in the map listing.

[Open Spin and make a wheel](https://spin.loftwah.com/) · [Browse more App Composer mini-apps](/apps)

## Spin brand assets

[Logo for dark backgrounds](/spin-brand/composer-spin-lockup-dark-20261127b.png) · [Logo for light backgrounds](/spin-brand/composer-spin-lockup-light-20261127b.png) · [App icon](/spin-brand/icon-512.png) · [Social preview](/spin-brand/decision-wheel-20261127b.jpg)
