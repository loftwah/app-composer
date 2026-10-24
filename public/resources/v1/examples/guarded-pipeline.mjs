// Fictional local exercise. No network, deployment or shell commands.
export async function pipeline({ check, review, publish, verify }) {
  const completed = [];
  for (const [name, action] of Object.entries({ check, review, publish, verify })) {
    try {
      if (await action() !== true) throw Error(`${name} did not confirm success`);
      completed.push(name);
    } catch (cause) {
      // Trusted adapters may classify a known failure. Never copy provider
      // messages, payloads or credentials into the portable receipt.
      const known = ['ACCESS_REQUIRED', 'VALIDATION_FAILED', 'EFFECT_UNKNOWN'];
      const code = known.includes(cause?.code) ? cause.code
        : name === 'publish' ? 'EFFECT_UNKNOWN' : 'CHECK_NOT_CONFIRMED';
      return { state: 'needs-attention', stage: name, completed, code,
        reason: ({ ACCESS_REQUIRED: 'The selected target needs access.',
          VALIDATION_FAILED: 'The required validation failed.',
          EFFECT_UNKNOWN: 'The effect may have completed; its target must be inspected.',
          CHECK_NOT_CONFIRMED: 'This stage did not confirm success.' })[code],
        next: name === 'publish' ? 'Reconcile target state before retry; publication may be uncertain.' : 'Inspect the failing stage and source before continuing.' };
    }
  }
  return { state: 'verified', completed };
}
