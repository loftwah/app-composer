// Fictional local exercise. No network, deployment or shell commands.
export async function pipeline({ check, review, publish, verify }) {
  const completed = [];
  for (const [name, action] of Object.entries({ check, review, publish, verify })) {
    try {
      if (await action() !== true) throw Error(`${name} did not confirm success`);
      completed.push(name);
    } catch {
      return { state: 'needs-attention', stage: name, completed,
        next: name === 'publish' ? 'Reconcile target state before retry; publication may be uncertain.' : 'Inspect the failing stage and source before continuing.' };
    }
  }
  return { state: 'verified', completed };
}
