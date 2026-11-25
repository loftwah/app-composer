import { definePlugin } from 'emdash';
import { printsOrigin } from '../lib/prints-site.mjs';

const links = [
  ['Get Prints Desktop', '/#downloads'],
  ['Make a poster', '/make'],
  ['Open download statistics', '/downloads'],
] as const;

export function createPlugin() {
  return definePlugin({
    id: 'composer-prints',
    version: '1.0.0',
    admin: {
      pages: [{ path: '/prints', label: 'Prints Desktop', icon: 'image' }],
    },
    routes: {
      admin: {
        methods: ['POST'],
        permission: 'plugins:manage',
        handler: async ({ input }) => {
          if (!input || typeof input !== 'object' || !('type' in input) || input.type !== 'page_load')
            return { blocks: [] };
          return {
            blocks: [
              { type: 'header', text: 'Prints Desktop' },
              { type: 'section', text: 'Open the independent Prints workspace, work through a prompt, or check the public download report.' },
              { type: 'actions', elements: links.map(([label, path]) => ({
                type: 'link', label, target: { kind: 'external', url: printsOrigin + path },
              })) },
            ],
          };
        },
      },
    },
  });
}
