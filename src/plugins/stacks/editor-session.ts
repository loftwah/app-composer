export interface EditCheckpoint {
  stack: string | undefined;
  generation: number;
  revision: number;
}

// Synchronous bookkeeping is independent of React's render closures. Only an
// acknowledgement for the exact submitted generation can make that draft clean.
export class EditorSession {
  stack: string | undefined;
  generation = 0;
  acknowledged = 0;
  revision = 0;

  get dirty() {
    return this.generation !== this.acknowledged;
  }

  capture(): EditCheckpoint {
    return {
      stack: this.stack,
      generation: this.generation,
      revision: this.revision,
    };
  }

  unchanged(checkpoint: EditCheckpoint) {
    return (
      checkpoint.stack === this.stack &&
      checkpoint.generation === this.generation &&
      checkpoint.revision === this.revision
    );
  }

  adopt(stack: string | undefined, revision = 0) {
    this.stack = stack;
    this.revision = revision;
    this.acknowledged = ++this.generation;
  }

  edit() {
    return ++this.generation;
  }

  acknowledge(
    checkpoint: EditCheckpoint,
    revision: number,
    savedDraft = false,
  ) {
    if (
      !Number.isSafeInteger(revision) ||
      revision <= checkpoint.revision ||
      checkpoint.stack !== this.stack ||
      revision < this.revision
    )
      return false;
    const exact = this.unchanged(checkpoint);
    this.revision = revision;
    if (savedDraft && exact) this.acknowledged = checkpoint.generation;
    return true;
  }
}
