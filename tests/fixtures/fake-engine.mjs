// Stand-in for an external engine (e.g. a Browser Use sidecar). Reads the request on stdin,
// "browses" by fetching the start URL, and reports events in the Buyer Arena contract.
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', async () => {
  const req = JSON.parse(input);
  const url = req.brief.start_url;
  const html = await (await fetch(url)).text();
  const sawPrice = /€\s?\d+/.test(html);
  const events = [
    { type: 'navigate', url, step: 0 },
    {
      type: 'decision',
      url,
      step: 1,
      detail: sawPrice ? 'I can see a price; that is enough.' : 'Could not find the price.',
    },
  ];
  if (sawPrice) events.push({ type: 'milestone', url, step: 1, target: 'pricing_found' });
  events.push({ type: 'abandon', url, step: 1, detail: 'External engine demo stops here.' });
  process.stdout.write(
    JSON.stringify({ status: 'abandoned', final_url: url, abandon_reason: 'demo engine', events }),
  );
});
