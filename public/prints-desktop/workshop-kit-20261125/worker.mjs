const formats = {
  feed: { width: 1080, height: 1350, caption: 'Midnight Arcade is open. One token gets you in.' },
  link: { width: 1200, height: 630, caption: 'Midnight Arcade. Play past closing time.' },
};

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/brief') return new Response('Open /api/brief?format=feed', { status: 404 });
    if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });

    const format = url.searchParams.get('format') ?? 'feed';
    if (!Object.hasOwn(formats, format)) return Response.json({ error: 'Use feed or link.' }, { status: 400 });
    return Response.json({
      mode: 'rehearsal-fixture',
      inferenceCalls: 0,
      project: 'Midnight Arcade',
      format,
      ...formats[format],
    }, { headers: { 'Cache-Control': 'no-store' } });
  },
};
