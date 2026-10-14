export const tutorialKey = 'composer-tutorial-v1';

// Learning notes are self-reported. They never enter the readiness engine.
export function readTutorialProgress(raw, checkIds, lessonIds) {
 try {
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || !Array.isArray(value.checked) ||
      value.checked.length > checkIds.length ||
      !value.checked.every(id => typeof id === 'string' && checkIds.includes(id)) ||
      new Set(value.checked).size !== value.checked.length ||
      !lessonIds.includes(value.lesson) ||
      Object.keys(value).some(key => !['version', 'checked', 'lesson'].includes(key))) return null;
  return {version: 1, checked: value.checked, lesson: value.lesson};
 } catch { return null; }
}
