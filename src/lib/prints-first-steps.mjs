import { printsOrigin } from './prints-site.mjs';
export const printsFirstSteps = [
  {
    key: 'browse', title: 'I want to open the app',
    detail: 'See what an original looks like alongside its release cut. The desktop archive, search and export work offline.',
    href: printsOrigin + '/#downloads', action: 'Get the desktop preview',
    prompt: 'Build a small contact sheet from three images already in my project. Use the original files. Give me one line of provenance for each, then recommend which should be my lead image and why. Keep the originals byte-for-byte.',
  },
  {
    key: 'poster', title: 'I want to make a poster',
    detail: 'Start with a finished brief. Use any image tool you already have, then open the result in Prints Desktop.',
    href: '#brief', action: 'Read the image-making steps',
    prompt: 'Create a 4:5 editorial poster for an imaginary night train called LAST TRAIN HOME. A single cream ticket curls into a coastline on a black station floor. One signal-orange lamp lights the fold. Make the exact words “LAST TRAIN HOME” large enough to read at 300 pixels wide. Use no other lettering. Keep the main object and words inside the middle 80 percent.',
  },
  {
    key: 'agents', title: 'I want my AI agent to help',
    detail: 'Start with a read-only library call on a Prints installation you can access. The agent can help shortlist work with its provenance.',
    href: '#run', action: 'See the MCP walkthrough',
    prompt: 'Use the authorised Prints tool to read the selected library. List up to five images with their filename, dimensions and any recorded brief or model. Pick two with different crops and explain which is better for a link preview. If the library is unavailable, tell me which folder or permission to check. Keep the run read-only.',
  },
  {
    key: 'shiitake', title: 'I use Shiitake',
    detail: 'Run the terminal agent in a project folder to develop the brief, then send the draft to your own approved Prints host when you’re ready.',
    href: 'https://docs.fungi.computer/guides/use-the-terminal/', action: 'Open the Shiitake quickstart',
    prompt: 'Read the public project README and draft prints-brief.md in this folder. Write a single image prompt with one visual joke, exactly one headline, a 4:5 feed crop and a 1200×630 link crop. Add a three-item review list for spelling, contrast and credit. Draft the file locally and keep inference off.',
  },
  {
    key: 'local', title: 'I just want to keep my own files',
    detail: 'Download the portable preview and use the local archive or import your own images. This workflow needs no wallet, account or generation credits.',
    href: printsOrigin + '/guide', action: 'Follow the offline guide',
    prompt: 'Write a short offline workflow for keeping the originals of my next three images. Give each one a folder name, a brief.txt with the source and intended use, and a place for one square and one landscape export. Preserve all original filenames and files.',
  },
  {
    key: 'builders', title: 'I’m building with AI',
    detail: 'Run the included Worker with a fictional brief. Try Gateway on your own account when you want visibility into a real model request.',
    href: printsOrigin + '/workshop-kit#lab', action: 'Run the Worker lab',
    prompt: 'Help me add a POSTER brief to the local workshop Worker. Return a caption and dimensions for feed and link outputs. Include one valid request for each format and one rejected input. Keep the rehearsal deterministic and report zero inference calls. Then list the authorised account settings needed for a separate live Gateway check.',
  },
];
