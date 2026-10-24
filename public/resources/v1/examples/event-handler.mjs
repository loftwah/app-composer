// Fictional data boundary, NOT a webhook server or provider signature verifier.
// Authentication must complete upstream under the actual provider protocol.
export async function acceptEvent(event, { authenticated, workspace, environment, store, effect }) {
  if (authenticated !== true) throw Error('Authentication required');
  const validScope = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
  if (!validScope(workspace) || !validScope(environment)) {
    throw Error('Select a valid workspace and environment before processing events');
  }
  if (!event || event.schema !== 'composer.example-enquiry/1' ||
      typeof event.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(event.id) ||
      event.workspace !== workspace || event.environment !== environment ||
      typeof event.message !== 'string' || event.message.length > 2000) {
    throw Error('Invalid event or target');
  }
  const key = `${workspace}/${environment}/${event.id}`;
  const prior = store.get(key);
  if (prior) return { state: prior, repeated: false };
  // The local Map is synchronous. Production needs a durable unique claim,
  // scoped permissions and persisted steps, not an in-memory check-and-send.
  store.set(key, 'uncertain');
  try {
    await effect({ id: key, message: event.message }); // Message stays data.
    store.set(key, 'finished');
    return { state: 'finished', repeated: false };
  } catch {
    return { state: 'uncertain', repeated: false, next: 'Reconcile the effect before repetition.' };
  }
}
