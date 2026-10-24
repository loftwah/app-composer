// Isolated local exercise. No production authority or external resources.
export function syntheticIncident({ responseAuthorised = false } = {}) {
  const target = { status: 'broken', revision: 'fixture-bad' };
  const journey = () => target.status === 'healthy' ? 'Visitor book opens' : 'Visitor book unavailable';
  const timeline = [{ step: 'observe', actual: journey() }];
  if (!responseAuthorised) return { recovered: false, timeline, next: 'Response authority required' };
  target.status = 'healthy'; target.revision = 'fixture-good';
  timeline.push({ step: 'authorised local response', actual: target.revision });
  const recovered = journey() === 'Visitor book opens';
  timeline.push({ step: 'independent journey check', actual: journey() });
  return { recovered, timeline, source: target.revision };
}
