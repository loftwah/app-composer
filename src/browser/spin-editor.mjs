import { spinChoiceLimit, validateSpinConfig } from '../lib/spin-protocol.mjs';
import { recommendTakeaway } from '../lib/spin-tastes.mjs';
import { spinPresetById, spinPresetGroups } from '../lib/spin-presets.mjs';

const storageKey = 'composer-spin-wheels-v1';
const foodPresets = new Set(spinPresetGroups.find(group => group.id === 'food').presets.map(preset => preset.id));

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.wheels) && Array.isArray(saved.favourites) && Array.isArray(saved.recent)) return saved;
  } catch {}
  return { draft: null, wheels: [], favourites: [], recent: [], suburb: '' };
}

const fromPreset = id => ({
  preset: id,
  question: spinPresetById[id].question,
  bestOf: 1,
  choices: spinPresetById[id].entries.map(label => ({ label, enabled: true })),
});

export function nearbySearch(winner) {
  const suburb = readPreferences().suburb;
  const query = [winner, suburb || 'near me'].join(' ');
  return 'https://www.google.com/maps/search/?' + new URLSearchParams({ api: '1', query });
}

export function mountSpinEditor(form, spinButton, onPreview) {
  const find = key => form.querySelector('[data-' + key + ']');
  const { question, bestOf, suburb, paste, entry } = form.elements;
  const prefs = readPreferences();
  const tastes = Array.isArray(prefs.tastes) ? prefs.tastes : [];
  const pickedTastes = new Set(tastes);
  const tasteButtons = [...form.querySelectorAll('[data-taste]')];
  const tasteSuggestions = find('taste-suggestions');
  const tasteAddAll = find('taste-add-all');
  const normalized = label => label.trim().normalize('NFC').toLocaleLowerCase('en-AU');
  let draft = prefs.draft ?? fromPreset('fast-food-three');
  if (draft.preset === 'fast-food-three' && draft.question === 'Which fast food should we get?') draft.question = spinPresetById['fast-food-three'].question;
  const template = new URLSearchParams(location.hash.slice(1)).get('wheel');
  if (template) {
    try {
      const config = validateSpinConfig(JSON.parse(template));
      if (config) {
        draft = {
          preset: 'custom', question: config.question, bestOf: config.bestOf,
          choices: config.entries.map(label => ({ label, enabled: true })),
        };
      }
    } catch {}
    history.replaceState(null, '', location.pathname + location.search);
  }
  const list = find('choices-list');
  const search = find('choice-search');
  const message = find('editor-message');
  const presets = form.closest('.play').querySelector('[data-spin-presets]');
  const fastFood = presets.querySelector('[data-quick-chains]');
  const quickPresets = [...presets.querySelectorAll('[data-quick-preset]')];
  const presetPickers = [...presets.querySelectorAll('[data-preset-picker]')];

  const active = () => draft.choices.filter(item => item.enabled && item.label.trim()).map(item => item.label.trim());
  const persist = () => {
    draft.question = question.value;
    draft.bestOf = bestOf.value;
    prefs.draft = draft;
    prefs.suburb = suburb.value.trim();
    prefs.tastes = [...pickedTastes];
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch {}
  };

  function update() {
    const entries = active();
    const count = entries.length;
    list.dataset.numbered = String(count > 12);
    const distinct = new Set(entries.map(entry => entry.normalize('NFC').toLocaleLowerCase('en-AU'))).size === count;
    const odds = count < 2 ? 'Enable at least two choices.' :
      `${new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 2 }).format(1 / count)} each`;
    find('choice-odds').textContent = distinct ? odds : 'Use different names for each choice.';
    spinButton.disabled = count < 2 || !distinct;
    persist();
    const foodIdeas = foodPresets.has(draft.preset) || draft.preset === 'custom';
    find('taste-cloud').hidden = !foodIdeas;
    onPreview(entries, foodIdeas);
    renderTasteSuggestions();
  }

  function addSuggested(labels) {
    const rows = new Map(draft.choices.map(row => [normalized(row.label), row]));
    const additions = labels.filter(label => !rows.has(normalized(label)));
    if (draft.choices.length + additions.length > spinChoiceLimit) {
      find('taste-status').textContent = `This wheel is limited to ${spinChoiceLimit} choices. Add individual suggestions or remove a choice.`;
      return;
    }
    for (const label of labels) {
      const row = rows.get(normalized(label));
      if (row) row.enabled = true;
    }
    draft.choices.push(...additions.map(label => ({ label, enabled: true })));
    search.value = '';
    renderRows();
    update();
  }

  function renderTasteSuggestions() {
    for (const button of tasteButtons) button.setAttribute('aria-pressed', String(pickedTastes.has(button.dataset.taste)));
    const suggestions = recommendTakeaway([...pickedTastes]);
    const included = new Set(active().map(normalized));
    const available = suggestions.filter(idea => !included.has(normalized(idea.label)));
    find('taste-status').textContent = available.length
      ? `${available.length} ${available.length === 1 ? 'idea' : 'ideas'} to add`
      : suggestions.length ? 'These ideas are already on the wheel.' : '';
    tasteAddAll.hidden = available.length < 2;
    const focused = document.activeElement?.dataset.suggestion;
    tasteSuggestions.replaceChildren(...suggestions.map(idea => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.suggestion = idea.label;
      const onWheel = included.has(normalized(idea.label));
      button.disabled = onWheel;
      button.setAttribute('aria-label', onWheel ? idea.label + ' is on the wheel' : 'Add ' + idea.label);
      button.textContent = onWheel ? idea.label + ' added' : '+ ' + idea.label;
      button.addEventListener('click', () => addSuggested([idea.label]));
      return button;
    }));
    if (focused) {
      const next = [...tasteSuggestions.children].find(button => !button.disabled);
      (next ?? tasteButtons.find(button => pickedTastes.has(button.dataset.taste)))?.focus({preventScroll: true});
    }
  }

  for (const button of tasteButtons) button.addEventListener('click', () => {
    const key = button.dataset.taste;
    if (pickedTastes.has(key)) pickedTastes.delete(key);
    else pickedTastes.add(key);
    persist();
    renderTasteSuggestions();
  });
  tasteAddAll.addEventListener('click', () => {
    addSuggested(recommendTakeaway([...pickedTastes]).map(idea => idea.label));
    if (tasteAddAll.hidden) tasteButtons.find(button => pickedTastes.has(button.dataset.taste))?.focus({preventScroll: true});
  });

  function renderRows(focus) {
    list.replaceChildren();
    const term = search.value.trim().toLocaleLowerCase('en-AU');
    let enabledIndex = 0;
    draft.choices.forEach((choice, index) => {
      if (choice.enabled && choice.label.trim()) enabledIndex++;
      if (term && !choice.label.toLocaleLowerCase('en-AU').includes(term)) return;
      const item = document.createElement('li');
      const label = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = choice.enabled;
      check.setAttribute('aria-label', 'Include ' + (choice.label || 'choice ' + (index + 1)));
      check.addEventListener('change', () => {
        choice.enabled = check.checked;
        renderRows({ index, control: check.dataset.control });
        update();
      });
      check.dataset.control = 'include';
      const order = document.createElement('span');
      order.textContent = choice.enabled && choice.label.trim() ? String(enabledIndex) : '–';
      order.setAttribute('aria-hidden', 'true');
      const field = document.createElement('input');
      field.type = 'text';
      field.value = choice.label;
      field.maxLength = 56;
      field.dataset.control = 'label';
      field.setAttribute('aria-label', 'Edit choice ' + (index + 1));
      field.addEventListener('input', () => {
        choice.label = field.value;
        check.setAttribute('aria-label', 'Include ' + (field.value || 'choice ' + (index + 1)));
        update();
      });
      field.addEventListener('change', () => {
        // Re-number only once editing settles. Keep focus on the text input.
        [...list.children].forEach(row => {
          const rowChoice = draft.choices[Number(row.dataset.index)];
          const rank = draft.choices.slice(0, Number(row.dataset.index) + 1).filter(entry => entry.enabled && entry.label.trim()).length;
          row.querySelector('[aria-hidden=true]').textContent = rowChoice.enabled && rowChoice.label.trim() ? String(rank) : '–';
        });
      });
      const step = (delta, text, hint) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.dataset.control = delta < 0 ? 'up' : 'down';
        button.setAttribute('aria-label', hint + ' choice ' + (index + 1));
        const target = index + delta;
        button.disabled = target < 0 || target >= draft.choices.length;
        button.addEventListener('click', () => {
          [draft.choices[index], draft.choices[target]] = [draft.choices[target], draft.choices[index]];
          renderRows({ index: target, control: button.dataset.control });
          update();
        });
        return button;
      };
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove choice ' + (index + 1));
      remove.addEventListener('click', () => {
        draft.choices.splice(index, 1);
        renderRows({ index: Math.min(index, draft.choices.length - 1), control: 'label' });
        update();
      });
      label.append(check, order);
      item.dataset.index = String(index);
      item.dataset.enabled = String(choice.enabled);
      item.append(label, field, step(-1, '↑', 'Move up'), step(1, '↓', 'Move down'), remove);
      list.append(item);
    });
    if (focus) {
      const row = list.querySelector(`[data-index="${focus.index}"]`);
      const preferred = row?.querySelector(`[data-control="${focus.control}"]:not(:disabled)`);
      (preferred ?? row?.querySelector('[data-control=label]') ?? find('add-choice')).focus();
    }
  }

  function renderCollection() {
    const renderOptions = (target, items, placeholder) => {
      target.replaceChildren(new Option(placeholder, ''), ...items);
      target.disabled = items.length === 0;
    };
    renderOptions(find('saved-wheels'), prefs.wheels.map(wheel => new Option(wheel.title, wheel.id)), 'Open a saved wheel');
    renderOptions(find('favourites'), prefs.favourites.map(id => new Option(spinPresetById[id].label, id)), 'Open a favourite');
    renderOptions(find('recent-wheels'), prefs.recent.map(id => new Option(spinPresetById[id].label, id)), 'Open a recent preset');
    fastFood.setAttribute('aria-pressed', String(draft.preset === 'fast-food-three'));
    for (const button of quickPresets) {
      button.setAttribute('aria-pressed', String(draft.preset === button.dataset.quickPreset));
    }
    const starred = prefs.favourites.includes(draft.preset);
    find('favourite').setAttribute('aria-pressed', String(starred));
    find('favourite').textContent = starred ? 'Remove favourite' : 'Favourite preset';
  }

  function showDraft(next) {
    draft = next;
    question.value = draft.question || 'What should we pick?';
    bestOf.value = String(draft.bestOf);
    if (!bestOf.value) bestOf.value = '1';
    search.value = '';
    for (const picker of presetPickers) picker.value = '';
    renderRows();
    renderCollection();
    update();
  }

  function pick(id) {
    if (!Object.hasOwn(spinPresetById, id)) return;
    prefs.recent = [id, ...prefs.recent.filter(item => item !== id)].slice(0, 8);
    showDraft({ ...fromPreset(id), bestOf: bestOf.value });
    message.textContent = spinPresetById[id].label + ' loaded.';
  }

  for (const picker of presetPickers) picker.addEventListener('change', () => pick(picker.value));
  fastFood.addEventListener('click', () => pick('fast-food-three'));
  find('show-order').addEventListener('change', event => {
    list.dataset.reorder = String(event.target.checked);
  });
  find('clear-wheel').addEventListener('click', () => {
    pick('custom');
    entry.focus();
  });
  for (const button of quickPresets) button.addEventListener('click', () => pick(button.dataset.quickPreset));
  find('reset').addEventListener('click', () => pick(draft.preset));
  find('favourites').addEventListener('change', event => pick(event.target.value));
  find('recent-wheels').addEventListener('change', event => pick(event.target.value));
  find('favourite').addEventListener('click', () => {
    const id = draft.preset;
    prefs.favourites = prefs.favourites.includes(id) ?
      prefs.favourites.filter(item => item !== id) : [...prefs.favourites, id];
    renderCollection();
    persist();
  });
  find('saved-wheels').addEventListener('change', event => {
    const wheel = prefs.wheels.find(item => item.id === event.target.value);
    if (wheel) showDraft(structuredClone(wheel.draft));
  });

  function save(duplicate) {
    const title = question.value.trim();
    if (!title || active().length < 2) {
      message.textContent = 'Give the wheel a question and two choices before saving it.';
      return;
    }
    const saved = prefs.wheels.find(wheel => wheel.id === draft.savedId);
    if (duplicate || !saved) {
      if (prefs.wheels.length >= 24) {
        message.textContent = 'You have 24 saved wheels. Open one and remove it to save another.';
        return;
      }
      draft.savedId = crypto.randomUUID();
      prefs.wheels.unshift({ id: draft.savedId, title: duplicate ? title + ' (copy)' : title, draft: structuredClone(draft) });
    } else {
      saved.title = title;
      saved.draft = structuredClone(draft);
    }
    renderCollection();
    persist();
    message.textContent = duplicate ? 'Copy saved on this device.' : 'Wheel saved on this device.';
  }
  find('save-wheel').addEventListener('click', () => save(false));
  find('duplicate-wheel').addEventListener('click', () => save(true));
  find('remove-wheel').addEventListener('click', () => {
    if (!draft.savedId) {
      message.textContent = 'Open a saved wheel to remove that copy.';
      return;
    }
    prefs.wheels = prefs.wheels.filter(wheel => wheel.id !== draft.savedId);
    delete draft.savedId;
    renderCollection();
    persist();
    message.textContent = 'Saved copy removed. Your current draft is still open.';
  });

  for (const button of form.querySelectorAll('[data-enable]')) button.addEventListener('click', () => {
    for (const item of draft.choices) item.enabled = button.dataset.enable === 'all';
    renderRows();
    update();
  });

  function addChoices(values) {
    if (draft.choices.length + values.length > spinChoiceLimit) {
      message.textContent = `A wheel can hold ${spinChoiceLimit} choices. Remove an entry to make room.`;
      return false;
    }
    draft.choices.push(...values.map(label => ({ label, enabled: true })));
    search.value = '';
    renderRows();
    update();
    return true;
  }
  function addEntry() {
    const value = entry.value.trim();
    if (value && addChoices([value])) {
      entry.value = '';
      message.textContent = value + ' added.';
    }
    entry.focus();
  }
  find('add-choice').addEventListener('click', addEntry);
  entry.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      addEntry();
    }
  });
  find('paste-choices').addEventListener('click', () => {
    const values = paste.value.split(/\r?\n/).map(text => text.trim()).filter(Boolean);
    if (!values.length || values.some(value => value.length > 56)) {
      message.textContent = 'Paste one choice per line, up to 56 characters each.';
      return;
    }
    if (addChoices(values)) {
      paste.value = '';
      message.textContent = `${values.length} choices added.`;
    }
  });

  list.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.matches('input[type="text"]')) event.preventDefault();
  });
  search.addEventListener('input', () => renderRows());
  question.addEventListener('input', update);
  question.addEventListener('keydown', event => {
    if (event.key === 'Enter') event.preventDefault();
  });
  bestOf.addEventListener('input', update);
  suburb.value = prefs.suburb;
  suburb.addEventListener('input', persist);
  showDraft(draft);
  return active;
}
