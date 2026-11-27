---
layout: "../../layouts/Article.astro"
title: "Why we built App Composer Spin"
description: "Put your choices on a wheel, spin, and send the result to your friends."
cover: "/campaign/spin/let-it-spin-wide-20261128.jpg"
coverAlt: "What’s for dinner? Let the wheel pick. Three cutout takeaway meals orbit on lilac. Spin by App Composer."
coverCaption: "Original AI-generated campaign artwork for App Composer Spin."
published: "2026-11-27"
---

The dinner chat keeps coming back to Maccas, Hungry Jack’s and KFC. [Spin](https://spin.loftwah.com/) opens with those three choices. Edit the list or pick another wheel from All presets. There are wheels for game night, chores and who goes first. You can save a wheel on your device without signing in.

For more dinner ideas, pick Australian takeaway roulette or open Food ideas in the editor. Tap what sounds good and add any of the suggestions to the wheel.

## Send a spin to a friend

The share image appears after the spin. Pick a post size and copy the image or save it as a PNG. Share result takes you to the image and the result link. If you want to send the link first, choose Share wheel, then Get a link before spinning. Your friends can use that same link to see the result later. The link lasts 30 days.

In a best-of-three series with two choices, the first to two wins takes it. With more choices, Spin counts three rounds and spins again among the leaders if they tie. Open tally keeps counting until you choose Finish and can end in a tie.

## How Spin checks a result

Before the first spin, the server fixes the choices, their order and the rules, and picks a random seed. It gives you a draw code based on those values. Open Spin history and look under Draw code to compare it with the code someone shared before the spin.

Each round uses HMAC-SHA-256 on the seed, rules and round number. Rejection sampling gives each eligible choice the same chance. When the spin or series ends, the browser gets the seed and checks the code, rounds and tally. You can download the draw record as JSON and run the check yourself.

The check covers one draw and relies on the server choosing a random seed. Someone can start several draws and share only their favourite. Use the link or the draw record to check a result you see in a picture or video.

## See a spin

[Australian takeaway](https://spin.loftwah.com/?example=takeaway) · [Game night](https://spin.loftwah.com/?example=game-night) · [Heads or tails](https://spin.loftwah.com/?example=coin)

These examples stay available after the original links expire. [Get the Spin artwork](/share/spin).

## Find takeaway

Add a suburb or postcode such as Sunbury VIC 3429. Spin keeps it on your device. When a takeaway choice wins, Nearby opens a Maps search. Check the shop’s hours and menu there.

[Make a wheel](https://spin.loftwah.com/) · [Browse App Composer apps](/apps)

## Spin brand assets

[Logo for dark backgrounds](/spin-brand/live/lockup-dark.png) · [Logo for light backgrounds](/spin-brand/live/lockup-light.png) · [App icon](/spin-brand/live/spin-512.png) · [Social preview](/campaign/spin/let-it-spin-wide-20261128.jpg) · [Launch kit and QR](/share/spin#social-kit)
