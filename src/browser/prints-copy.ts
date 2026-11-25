for (const button of document.querySelectorAll<HTMLButtonElement>('[data-workshop] button[data-copy-target]')) {
  const source = document.getElementById(button.dataset.copyTarget ?? '');
  const status = button.closest('details, .prompt')?.querySelector('[data-copy-status]');
  if (!source || !status || !navigator.clipboard?.writeText) continue;
  button.hidden = false;
  button.addEventListener('click', async () => {
    const value = source instanceof HTMLTextAreaElement ? source.value : source.textContent ?? '';
    try {
      await navigator.clipboard.writeText(value);
      status.textContent = 'Copied.';
    } catch {
      if (source instanceof HTMLTextAreaElement) source.select();
      status.textContent = 'Select the text and copy it from here.';
    }
  });
}

export {};
