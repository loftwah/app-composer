---
title: "A smaller way to publish"
description: "Why a plain Markdown file can be the most durable place to start a website."
date: "2026-11-19"
draft: false
---

A website does not need a database to be useful. This one is made of a few Markdown files and a small Astro layout, which means the words stay easy to read, edit and keep.

## Start with the words

Write a post as a file in `src/content/posts/`. The file name becomes its address, so `first-post.md` lives at `/posts/first-post/`. A short frontmatter block gives the post a title, a description and a date.

- Plain text stays readable years from now.
- Git keeps the history of every edit.
- A static build publishes the same pages everywhere.

## Make it yours

Change the values in `src/site.json` for the site title, description and about text, then replace this page with your own writing. Set `draft: true` in a post's frontmatter to keep it out of the public pages while you work on it.

This is fictional demonstration content — remove it before you publish.
