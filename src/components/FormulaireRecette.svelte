<script lang="ts">
  // ── Types ─────────────────────────────────────────────────────────────────
  interface Ingredient {
    id: string;
    nom: string;
    quantite: string;
    unite: string;
    note: string;
    interchangeable: boolean;
    suggestions: string[];
    showSuggestions: boolean;
    selectedIdx: number;
    debounceTimer: ReturnType<typeof setTimeout> | null;
  }

  interface Inspiration {
    id: string;
    url: string;
    label: string;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function slugify(str: string): string {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function escapeYaml(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  function makeIngredient(): Ingredient {
    return {
      id: crypto.randomUUID(),
      nom: '', quantite: '', unite: '', note: '',
      interchangeable: false,
      suggestions: [], showSuggestions: false, selectedIdx: -1,
      debounceTimer: null,
    };
  }

  function makeInspiration(): Inspiration {
    return { id: crypto.randomUUID(), url: '', label: '' };
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let title         = $state('');
  let date          = $state(new Date().toISOString().split('T')[0]);
  let description   = $state('');
  let image         = $state('');
  let difficulte    = $state<'facile' | 'moyen' | 'difficile'>('facile');
  let temps_prep    = $state(15);
  let temps_cuisson = $state(30);
  let portions_base = $state(4);
  let vegetarien    = $state(false);
  let vegan         = $state(false);

  let categories    = $state<string[]>([]);
  let categoryInput = $state('');
  let tags          = $state<string[]>([]);
  let tagInput      = $state('');

  let ingredients   = $state<Ingredient[]>([makeIngredient()]);
  let etapes        = $state<string[]>(['']);
  let astuces       = $state<string[]>([]);
  let inspirations  = $state<Inspiration[]>([]);

  let showYamlPreview = $state(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const slug = $derived(slugify(title));

  const canPropose = $derived(
    title.trim() !== '' &&
    description.trim() !== '' &&
    categories.length > 0 &&
    ingredients.some(i => i.nom.trim() !== '') &&
    etapes.some(e => e.trim() !== '')
  );

  const yamlContent = $derived(buildYaml());

  // ── Effects ───────────────────────────────────────────────────────────────
  $effect(() => {
    if (!vegetarien) vegan = false;
  });

  // ── Autocomplete OpenFoodFacts ────────────────────────────────────────────
  async function fetchSuggestions(term: string): Promise<string[]> {
    if (term.length < 2) return [];
    try {
      const res = await fetch(
        `https://fr.openfoodfacts.org/cgi/suggest.pl?tagtype=ingredients&term=${encodeURIComponent(term)}&lc=fr`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? (data as string[]).slice(0, 8) : [];
    } catch {
      return [];
    }
  }

  function onIngredientNomInput(i: number, value: string) {
    ingredients[i].nom = value;
    ingredients[i].selectedIdx = -1;
    if (ingredients[i].debounceTimer !== null) {
      clearTimeout(ingredients[i].debounceTimer!);
    }
    if (value.length < 2) {
      ingredients[i].suggestions = [];
      ingredients[i].showSuggestions = false;
      return;
    }
    ingredients[i].debounceTimer = setTimeout(async () => {
      const results = await fetchSuggestions(value);
      if (ingredients[i].nom === value) {
        ingredients[i].suggestions = results;
        ingredients[i].showSuggestions = results.length > 0;
      }
    }, 280);
  }

  function onIngredientKeydown(i: number, e: KeyboardEvent) {
    const ing = ingredients[i];
    if (!ing.showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ingredients[i].selectedIdx = Math.min(ing.selectedIdx + 1, ing.suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ingredients[i].selectedIdx = Math.max(ing.selectedIdx - 1, -1);
    } else if (e.key === 'Enter' && ing.selectedIdx >= 0) {
      e.preventDefault();
      selectSuggestion(i, ing.suggestions[ing.selectedIdx]);
    } else if (e.key === 'Escape') {
      ingredients[i].showSuggestions = false;
      ingredients[i].selectedIdx = -1;
    }
  }

  function onIngredientBlur(i: number) {
    setTimeout(() => {
      ingredients[i].showSuggestions = false;
      ingredients[i].selectedIdx = -1;
    }, 150);
  }

  function selectSuggestion(i: number, value: string) {
    ingredients[i].nom = value;
    ingredients[i].showSuggestions = false;
    ingredients[i].suggestions = [];
    ingredients[i].selectedIdx = -1;
  }

  // ── Ingrédients ───────────────────────────────────────────────────────────
  function addIngredient() {
    ingredients = [...ingredients, makeIngredient()];
  }

  function removeIngredient(i: number) {
    if (ingredients[i].debounceTimer !== null) {
      clearTimeout(ingredients[i].debounceTimer!);
    }
    ingredients = ingredients.filter((_, idx) => idx !== i);
  }

  // ── Chip inputs ───────────────────────────────────────────────────────────
  function commitChip(list: string[], value: string): string[] {
    const val = value.trim().toLowerCase().replace(/,$/, '').trim();
    if (val && !list.includes(val)) return [...list, val];
    return list;
  }

  function onCategoryKeydown(e: KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && categoryInput.trim()) {
      e.preventDefault();
      categories = commitChip(categories, categoryInput);
      categoryInput = '';
    } else if (e.key === 'Backspace' && categoryInput === '' && categories.length > 0) {
      categories = categories.slice(0, -1);
    }
  }

  function onCategoryBlur() {
    if (categoryInput.trim()) {
      categories = commitChip(categories, categoryInput);
      categoryInput = '';
    }
  }

  function onTagKeydown(e: KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      tags = commitChip(tags, tagInput);
      tagInput = '';
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
  }

  function onTagBlur() {
    if (tagInput.trim()) {
      tags = commitChip(tags, tagInput);
      tagInput = '';
    }
  }

  // ── Étapes ────────────────────────────────────────────────────────────────
  function addEtape() {
    etapes = [...etapes, ''];
  }

  function removeEtape(i: number) {
    if (etapes.length <= 1) return;
    etapes = etapes.filter((_, idx) => idx !== i);
  }

  function moveEtape(i: number, direction: -1 | 1) {
    const next = i + direction;
    if (next < 0 || next >= etapes.length) return;
    const arr = [...etapes];
    [arr[i], arr[next]] = [arr[next], arr[i]];
    etapes = arr;
  }

  // ── Astuces ───────────────────────────────────────────────────────────────
  function addAstuce() {
    astuces = [...astuces, ''];
  }

  function removeAstuce(i: number) {
    astuces = astuces.filter((_, idx) => idx !== i);
  }

  // ── Inspirations ──────────────────────────────────────────────────────────
  function addInspiration() {
    inspirations = [...inspirations, makeInspiration()];
  }

  function removeInspiration(i: number) {
    inspirations = inspirations.filter((_, idx) => idx !== i);
  }

  // ── YAML ──────────────────────────────────────────────────────────────────
  function buildYaml(): string {
    const lines: string[] = ['---'];

    lines.push(`title: "${escapeYaml(title)}"`);
    lines.push(`date: ${date}`);
    lines.push(`description: "${escapeYaml(description)}"`);

    if (image.trim()) {
      lines.push(`image: "${escapeYaml(image.trim())}"`);
    }

    lines.push(`categories: [${categories.map(c => `"${c}"`).join(', ')}]`);
    lines.push(`tags: [${tags.map(t => `"${t}"`).join(', ')}]`);
    lines.push(`difficulte: ${difficulte}`);
    lines.push(`temps_prep: ${temps_prep}`);
    lines.push(`temps_cuisson: ${temps_cuisson}`);
    lines.push(`portions_base: ${portions_base}`);
    lines.push(`vegetarien: ${vegetarien}`);
    lines.push(`vegan: ${vegan}`);

    const validIngredients = ingredients.filter(i => i.nom.trim() !== '');
    if (validIngredients.length > 0) {
      lines.push('ingredients:');
      for (const ing of validIngredients) {
        lines.push(`  - nom: "${escapeYaml(ing.nom)}"`);
        const qty = parseFloat(ing.quantite);
        lines.push(`    quantite: ${isNaN(qty) ? 0 : qty}`);
        lines.push(`    unite: "${escapeYaml(ing.unite)}"`);
        if (ing.note.trim()) lines.push(`    note: "${escapeYaml(ing.note)}"`);
        if (ing.interchangeable) lines.push(`    interchangeable: true`);
      }
    }

    const validEtapes = etapes.filter(e => e.trim() !== '');
    if (validEtapes.length > 0) {
      lines.push('etapes:');
      for (const e of validEtapes) {
        lines.push(`  - "${escapeYaml(e)}"`);
      }
    }

    const validAstuces = astuces.filter(a => a.trim() !== '');
    if (validAstuces.length > 0) {
      lines.push('astuces:');
      for (const a of validAstuces) {
        lines.push(`  - "${escapeYaml(a)}"`);
      }
    }

    const validInspirations = inspirations.filter(insp => insp.url.trim() !== '');
    if (validInspirations.length > 0) {
      lines.push('inspirations:');
      for (const insp of validInspirations) {
        lines.push(`  - url: "${escapeYaml(insp.url)}"`);
        if (insp.label.trim()) lines.push(`    label: "${escapeYaml(insp.label)}"`);
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('## Avis');
    lines.push('');

    return lines.join('\n');
  }

  // ── Proposer sur GitHub ───────────────────────────────────────────────────
  function proposeRecette() {
    if (!canPropose) return;
    const s = slug || 'nouvelle-recette';
    const base = 'https://github.com/Benoitdw/laCuisineDeBenoit/new/master';
    const params = new URLSearchParams({
      filename: `src/content/recettes/${s}/index.md`,
      value: yamlContent,
      message: `feat: nouvelle recette "${title}"`,
    });
    window.open(`${base}?${params}`, '_blank');
  }
</script>

<!-- ── Template ─────────────────────────────────────────────────────────── -->

<div class="formulaire">

  <!-- 1. Infos générales -->
  <div class="form-section">
    <div class="section-title">Informations générales</div>
    <div class="section-body">
      <div class="field">
        <label class="field-label" for="f-title">Titre *</label>
        <input
          id="f-title"
          class="field-input"
          type="text"
          value={title}
          oninput={(e) => { title = (e.target as HTMLInputElement).value; }}
          placeholder="ex. Tarte aux poireaux"
        />
        {#if slug}
          <span class="field-hint">→ src/content/recettes/<strong>{slug}</strong>/index.md</span>
        {/if}
      </div>
      <div class="field">
        <label class="field-label" for="f-date">Date</label>
        <input
          id="f-date"
          class="field-input field-input--short"
          type="date"
          value={date}
          oninput={(e) => { date = (e.target as HTMLInputElement).value; }}
        />
      </div>
      <div class="field">
        <label class="field-label" for="f-desc">Description *</label>
        <textarea
          id="f-desc"
          class="field-input field-textarea"
          rows="2"
          value={description}
          oninput={(e) => { description = (e.target as HTMLTextAreaElement).value; }}
          placeholder="Une courte phrase d'accroche"
        ></textarea>
      </div>
      <div class="field">
        <label class="field-label" for="f-image">Image <span class="optional">(optionnel)</span></label>
        <input
          id="f-image"
          class="field-input"
          type="text"
          value={image}
          oninput={(e) => { image = (e.target as HTMLInputElement).value; }}
          placeholder="/images/recettes/mon-slug/plat.png"
        />
      </div>
    </div>
  </div>

  <!-- 2. Temps & portions -->
  <div class="form-section">
    <div class="section-title">Temps & portions</div>
    <div class="section-body">
      <div class="row-3">
        <div class="field">
          <label class="field-label" for="f-prep">Préparation (min)</label>
          <input
            id="f-prep"
            class="field-input"
            type="number" min="0"
            value={temps_prep}
            oninput={(e) => { temps_prep = parseInt((e.target as HTMLInputElement).value) || 0; }}
          />
        </div>
        <div class="field">
          <label class="field-label" for="f-cuisson">Cuisson (min)</label>
          <input
            id="f-cuisson"
            class="field-input"
            type="number" min="0"
            value={temps_cuisson}
            oninput={(e) => { temps_cuisson = parseInt((e.target as HTMLInputElement).value) || 0; }}
          />
        </div>
        <div class="field">
          <label class="field-label" for="f-portions">Portions</label>
          <input
            id="f-portions"
            class="field-input"
            type="number" min="1"
            value={portions_base}
            oninput={(e) => { portions_base = parseInt((e.target as HTMLInputElement).value) || 1; }}
          />
        </div>
      </div>
      <div class="field">
        <label class="field-label">Difficulté</label>
        <div class="difficulte-group">
          {#each (['facile', 'moyen', 'difficile'] as const) as d}
            <label class="radio-label" class:active={difficulte === d}>
              <input
                type="radio"
                name="difficulte"
                value={d}
                checked={difficulte === d}
                onchange={() => { difficulte = d; }}
              />
              {d}
            </label>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <!-- 3. Régime -->
  <div class="form-section">
    <div class="section-title">Régime alimentaire</div>
    <div class="section-body">
      <div class="toggle-row">
        <label class="toggle-label">
          <button
            class="toggle-btn"
            class:on={vegetarien}
            type="button"
            onclick={() => { vegetarien = !vegetarien; }}
            role="switch"
            aria-checked={vegetarien}
          >
            <span class="toggle-thumb"></span>
          </button>
          Végétarien
        </label>
        <label class="toggle-label" class:disabled={!vegetarien}>
          <button
            class="toggle-btn"
            class:on={vegan}
            type="button"
            onclick={() => { if (vegetarien) vegan = !vegan; }}
            role="switch"
            aria-checked={vegan}
            disabled={!vegetarien}
          >
            <span class="toggle-thumb"></span>
          </button>
          Vegan
        </label>
      </div>
    </div>
  </div>

  <!-- 4. Catégories & Tags -->
  <div class="form-section">
    <div class="section-title">Catégories & Tags</div>
    <div class="section-body">
      <div class="field">
        <label class="field-label">Catégories * <span class="field-hint-inline">(Entrée ou , pour valider)</span></label>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="chip-field chip-field--copper" onclick={(e) => { if (e.target === e.currentTarget) { (e.currentTarget as HTMLElement).querySelector('input')?.focus(); } }}>
          {#each categories as cat}
            <span class="chip chip--copper">
              {cat}
              <button
                class="chip-remove"
                type="button"
                onclick={() => { categories = categories.filter(c => c !== cat); }}
                aria-label="Retirer {cat}"
              >×</button>
            </span>
          {/each}
          <input
            class="chip-input"
            type="text"
            value={categoryInput}
            oninput={(e) => { categoryInput = (e.target as HTMLInputElement).value; }}
            onkeydown={onCategoryKeydown}
            onblur={onCategoryBlur}
            placeholder={categories.length === 0 ? 'plat principal, entrée…' : ''}
          />
        </div>
      </div>
      <div class="field">
        <label class="field-label">Tags <span class="field-hint-inline">(Entrée ou , pour valider)</span></label>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="chip-field chip-field--fern" onclick={(e) => { if (e.target === e.currentTarget) { (e.currentTarget as HTMLElement).querySelector('input')?.focus(); } }}>
          {#each tags as tag}
            <span class="chip chip--fern">
              {tag}
              <button
                class="chip-remove"
                type="button"
                onclick={() => { tags = tags.filter(t => t !== tag); }}
                aria-label="Retirer {tag}"
              >×</button>
            </span>
          {/each}
          <input
            class="chip-input"
            type="text"
            value={tagInput}
            oninput={(e) => { tagInput = (e.target as HTMLInputElement).value; }}
            onkeydown={onTagKeydown}
            onblur={onTagBlur}
            placeholder={tags.length === 0 ? 'proteines, daily, rapide…' : ''}
          />
        </div>
      </div>
    </div>
  </div>

  <!-- 5. Ingrédients -->
  <div class="form-section">
    <div class="section-title">Ingrédients</div>
    <div class="section-body">
      <div class="ing-header">
        <span class="ing-col-nom">Ingrédient</span>
        <span class="ing-col-qty">Qté</span>
        <span class="ing-col-unite">Unité</span>
        <span class="ing-col-note">Note</span>
        <span class="ing-col-meta"></span>
      </div>

      {#each ingredients as ing, i (ing.id)}
        <div class="ingredient-row">
          <div class="autocomplete-wrap">
            <input
              class="field-input input-nom"
              type="text"
              value={ing.nom}
              oninput={(e) => onIngredientNomInput(i, (e.target as HTMLInputElement).value)}
              onkeydown={(e) => onIngredientKeydown(i, e)}
              onblur={() => onIngredientBlur(i)}
              placeholder="Ingrédient…"
              autocomplete="off"
              aria-autocomplete="list"
              aria-expanded={ing.showSuggestions}
            />
            {#if ing.showSuggestions}
              <ul class="suggestions" role="listbox">
                {#each ing.suggestions as s, si}
                  <li
                    class="suggestion-item"
                    class:selected={si === ing.selectedIdx}
                    role="option"
                    aria-selected={si === ing.selectedIdx}
                    onmousedown={() => selectSuggestion(i, s)}
                  >{s}</li>
                {/each}
              </ul>
            {/if}
          </div>

          <input
            class="field-input input-qty"
            type="number" min="0" step="any"
            value={ing.quantite}
            oninput={(e) => { ingredients[i].quantite = (e.target as HTMLInputElement).value; }}
            placeholder="0"
          />
          <input
            class="field-input input-unite"
            type="text"
            value={ing.unite}
            oninput={(e) => { ingredients[i].unite = (e.target as HTMLInputElement).value; }}
            placeholder="gr, ml…"
          />
          <input
            class="field-input input-note"
            type="text"
            value={ing.note}
            oninput={(e) => { ingredients[i].note = (e.target as HTMLInputElement).value; }}
            placeholder="note…"
          />

          <div class="ing-meta">
            <label
              class="interch-label"
              title="Ingrédient interchangeable"
            >
              <input
                type="checkbox"
                checked={ing.interchangeable}
                onchange={() => { ingredients[i].interchangeable = !ing.interchangeable; }}
              />
              <span class="interch-icon">⇄</span>
            </label>
            <button
              class="btn-remove"
              type="button"
              onclick={() => removeIngredient(i)}
              aria-label="Supprimer l'ingrédient"
            >×</button>
          </div>
        </div>
      {/each}

      <button class="btn-add" type="button" onclick={addIngredient}>
        + Ajouter un ingrédient
      </button>
    </div>
  </div>

  <!-- 6. Étapes -->
  <div class="form-section">
    <div class="section-title">Étapes</div>
    <div class="section-body">
      {#each etapes as etape, i}
        <div class="step-row">
          <span class="step-number">{i + 1}.</span>
          <textarea
            class="field-input step-textarea"
            rows="2"
            value={etape}
            oninput={(e) => { etapes[i] = (e.target as HTMLTextAreaElement).value; }}
            placeholder="Décrivez cette étape…"
          ></textarea>
          <div class="step-controls">
            <button
              class="btn-move"
              type="button"
              onclick={() => moveEtape(i, -1)}
              disabled={i === 0}
              aria-label="Monter"
            >↑</button>
            <button
              class="btn-move"
              type="button"
              onclick={() => moveEtape(i, 1)}
              disabled={i === etapes.length - 1}
              aria-label="Descendre"
            >↓</button>
            <button
              class="btn-remove"
              type="button"
              onclick={() => removeEtape(i)}
              disabled={etapes.length <= 1}
              aria-label="Supprimer"
            >×</button>
          </div>
        </div>
      {/each}

      <button class="btn-add" type="button" onclick={addEtape}>
        + Ajouter une étape
      </button>
    </div>
  </div>

  <!-- 7. Astuces -->
  <div class="form-section">
    <div class="section-title">Astuces <span class="optional">(optionnel)</span></div>
    <div class="section-body">
      {#each astuces as astuce, i}
        <div class="simple-row">
          <input
            class="field-input"
            type="text"
            value={astuce}
            oninput={(e) => { astuces[i] = (e.target as HTMLInputElement).value; }}
            placeholder="Une astuce…"
          />
          <button
            class="btn-remove"
            type="button"
            onclick={() => removeAstuce(i)}
            aria-label="Supprimer"
          >×</button>
        </div>
      {/each}

      <button class="btn-add" type="button" onclick={addAstuce}>
        + Ajouter une astuce
      </button>
    </div>
  </div>

  <!-- 8. Inspirations -->
  <div class="form-section">
    <div class="section-title">Inspirations <span class="optional">(optionnel)</span></div>
    <div class="section-body">
      {#each inspirations as insp, i (insp.id)}
        <div class="insp-row">
          <input
            class="field-input insp-url"
            type="url"
            value={insp.url}
            oninput={(e) => { inspirations[i].url = (e.target as HTMLInputElement).value; }}
            placeholder="https://…"
          />
          <input
            class="field-input insp-label"
            type="text"
            value={insp.label}
            oninput={(e) => { inspirations[i].label = (e.target as HTMLInputElement).value; }}
            placeholder="Label (optionnel)"
          />
          <button
            class="btn-remove"
            type="button"
            onclick={() => removeInspiration(i)}
            aria-label="Supprimer"
          >×</button>
        </div>
      {/each}

      <button class="btn-add" type="button" onclick={addInspiration}>
        + Ajouter une inspiration
      </button>
    </div>
  </div>

  <!-- 9. Aperçu YAML -->
  <div class="form-section yaml-section">
    <button
      class="section-title section-title--btn"
      type="button"
      onclick={() => { showYamlPreview = !showYamlPreview; }}
      aria-expanded={showYamlPreview}
    >
      <span>Aperçu YAML</span>
      <span class="yaml-meta">
        {yamlContent.length} car.
        {#if yamlContent.length > 6000}
          <span class="yaml-warn">⚠ URL longue — copiez le YAML manuellement si besoin</span>
        {/if}
        <span class="yaml-chevron">{showYamlPreview ? '▲' : '▼'}</span>
      </span>
    </button>
    {#if showYamlPreview}
      <div class="section-body yaml-body">
        <pre class="yaml-pre">{yamlContent}</pre>
      </div>
    {/if}
  </div>

  <!-- 10. CTA -->
  <div class="propose-bar">
    {#if !canPropose}
      <span class="propose-hint">Requis : titre, description, ≥1 catégorie, ≥1 ingrédient, ≥1 étape</span>
    {:else}
      <span class="propose-hint propose-hint--ready">
        Prêt — fichier : <code>src/content/recettes/{slug}/index.md</code>
      </span>
    {/if}
    <button
      class="btn-propose"
      type="button"
      onclick={proposeRecette}
      disabled={!canPropose}
    >
      Proposer sur GitHub →
    </button>
  </div>

</div>

<!-- ── Styles ─────────────────────────────────────────────────────────────── -->
<style>
  .formulaire {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-bottom: 6rem; /* espace pour la barre sticky */
  }

  /* ── Sections ── */
  .form-section {
    border: 1px solid var(--rule);
    border-radius: 4px;
    overflow: visible;
  }

  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: .72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--forest);
    padding: .6rem .9rem;
    border-bottom: 1px solid var(--rule);
    background: var(--card);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title--btn {
    width: 100%;
    border: none;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    text-align: left;
    transition: background .15s;
  }
  .section-title--btn:hover { background: color-mix(in srgb, var(--card) 85%, var(--copper) 15%); }

  .section-body {
    padding: .85rem .9rem;
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }

  .optional {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    font-size: .7rem;
    color: var(--muted);
    font-family: 'Lora', serif;
    font-style: italic;
  }

  /* ── Fields ── */
  .field {
    display: flex;
    flex-direction: column;
    gap: .3rem;
  }

  .field-label {
    font-family: 'Lora', serif;
    font-size: .78rem;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: .02em;
  }

  .field-hint {
    font-family: 'Lora', serif;
    font-size: .72rem;
    color: var(--muted);
    font-style: italic;
  }

  .field-hint-inline {
    font-weight: 400;
    font-size: .7rem;
    color: var(--muted);
    font-style: italic;
    font-family: 'Lora', serif;
    letter-spacing: 0;
    text-transform: none;
  }

  .field-input {
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 3px;
    padding: .42rem .6rem;
    font-family: 'Lora', serif;
    font-size: .875rem;
    color: var(--ink);
    outline: none;
    transition: border-color .15s;
    width: 100%;
    box-sizing: border-box;
  }
  .field-input:focus { border-color: var(--copper); }

  .field-input--short { max-width: 180px; }

  .field-textarea {
    resize: vertical;
    min-height: 3rem;
  }

  /* ── Row-3 ── */
  .row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: .65rem;
  }
  @media (max-width: 500px) {
    .row-3 { grid-template-columns: 1fr 1fr; }
  }

  /* ── Difficulté ── */
  .difficulte-group {
    display: flex;
    gap: .5rem;
    flex-wrap: wrap;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: .3rem;
    padding: .3rem .75rem;
    border: 1px solid var(--rule);
    border-radius: 3px;
    cursor: pointer;
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--muted);
    transition: border-color .15s, color .15s, background .15s;
  }
  .radio-label input { display: none; }
  .radio-label.active {
    border-color: var(--copper);
    color: var(--forest);
    background: rgba(173,107,53,.08);
    font-weight: 600;
  }
  .radio-label:hover { border-color: var(--copper); color: var(--ink); }

  /* ── Toggles ── */
  .toggle-row {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: .55rem;
    font-family: 'Lora', serif;
    font-size: .875rem;
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }
  .toggle-label.disabled { opacity: .4; cursor: default; }

  .toggle-btn {
    position: relative;
    width: 2.2rem;
    height: 1.2rem;
    background: var(--rule);
    border: none;
    border-radius: 1rem;
    cursor: pointer;
    transition: background .2s;
    padding: 0;
    flex-shrink: 0;
  }
  .toggle-btn.on { background: var(--fern); }
  .toggle-btn:disabled { cursor: default; }

  .toggle-thumb {
    position: absolute;
    top: .15rem;
    left: .15rem;
    width: .9rem;
    height: .9rem;
    background: var(--paper);
    border-radius: 50%;
    transition: transform .2s;
    pointer-events: none;
  }
  .toggle-btn.on .toggle-thumb { transform: translateX(1rem); }

  /* ── Chip inputs ── */
  .chip-field {
    display: flex;
    flex-wrap: wrap;
    gap: .3rem;
    padding: .35rem .45rem;
    border: 1px solid var(--rule);
    border-radius: 3px;
    background: var(--paper);
    cursor: text;
    min-height: 2.2rem;
    align-items: center;
    transition: border-color .15s;
  }
  .chip-field:focus-within { border-color: var(--copper); }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: .22rem;
    font-family: 'Lora', serif;
    font-size: .78rem;
    padding: .18rem .5rem;
    border-radius: 2px;
  }
  .chip--copper { background: rgba(173,107,53,.12); color: var(--forest); }
  .chip--fern { background: rgba(45,66,40,.12); color: var(--forest); }

  .chip-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: .82rem;
    padding: 0;
    line-height: 1;
    transition: color .1s;
  }
  .chip-remove:hover { color: var(--ink); }

  .chip-input {
    border: none;
    background: transparent;
    outline: none;
    font-family: 'Lora', serif;
    font-size: .875rem;
    color: var(--ink);
    flex: 1;
    min-width: 80px;
    padding: .1rem 0;
  }

  /* ── Ingrédients ── */
  .ing-header {
    display: grid;
    grid-template-columns: 1fr 4.5rem 5.5rem 1fr auto;
    gap: .4rem;
    padding: 0 0 .3rem;
    border-bottom: 1px solid var(--rule);
    margin-bottom: .2rem;
  }
  .ing-header span {
    font-family: 'Lora', serif;
    font-size: .7rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .ingredient-row {
    display: grid;
    grid-template-columns: 1fr 4.5rem 5.5rem 1fr auto;
    gap: .4rem;
    align-items: start;
    padding: .3rem 0;
    border-bottom: 1px solid rgba(28,22,14,.04);
  }

  @media (max-width: 640px) {
    .ing-header { display: none; }
    .ingredient-row {
      grid-template-columns: 1fr 4rem;
      grid-template-rows: auto auto;
    }
    .autocomplete-wrap { grid-column: 1 / -1; }
    .input-qty { grid-column: 1; }
    .input-unite { grid-column: 2; }
    .input-note { grid-column: 1 / -1; }
    .ing-meta { grid-column: 1 / -1; justify-content: flex-end; }
  }

  .autocomplete-wrap {
    position: relative;
  }

  .input-nom { width: 100%; }
  .input-qty { width: 100%; }
  .input-unite { width: 100%; }
  .input-note { width: 100%; }

  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--paper);
    border: 1px solid var(--copper);
    border-top: none;
    border-radius: 0 0 3px 3px;
    list-style: none;
    margin: 0;
    padding: 0;
    box-shadow: 0 4px 14px rgba(28,22,14,.13);
    max-height: 200px;
    overflow-y: auto;
  }

  .suggestion-item {
    padding: .38rem .65rem;
    font-family: 'Lora', serif;
    font-size: .85rem;
    color: var(--ink);
    cursor: pointer;
    border-bottom: 1px solid rgba(28,22,14,.05);
  }
  .suggestion-item:last-child { border-bottom: none; }
  .suggestion-item:hover,
  .suggestion-item.selected {
    background: rgba(173,107,53,.1);
    color: var(--forest);
  }

  .ing-meta {
    display: flex;
    align-items: center;
    gap: .3rem;
    padding-top: .42rem;
  }

  .interch-label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .interch-label input { display: none; }
  .interch-icon {
    font-size: .9rem;
    color: var(--muted);
    border: 1px solid var(--rule);
    border-radius: 2px;
    padding: .1rem .28rem;
    line-height: 1;
    transition: color .15s, border-color .15s, background .15s;
  }
  .interch-label:has(input:checked) .interch-icon {
    color: var(--fern);
    border-color: var(--fern);
    background: rgba(45,66,40,.08);
  }

  /* ── Étapes ── */
  .step-row {
    display: grid;
    grid-template-columns: 1.4rem 1fr auto;
    gap: .5rem;
    align-items: start;
    padding: .25rem 0;
    border-bottom: 1px solid rgba(28,22,14,.04);
  }

  .step-number {
    font-family: 'Playfair Display', serif;
    font-size: .8rem;
    color: var(--copper);
    padding-top: .5rem;
    text-align: right;
  }

  .step-textarea {
    resize: vertical;
    min-height: 2.5rem;
  }

  .step-controls {
    display: flex;
    flex-direction: column;
    gap: .2rem;
    padding-top: .3rem;
  }

  /* ── Simple rows (astuces) ── */
  .simple-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: .4rem;
    align-items: center;
  }

  /* ── Inspirations ── */
  .insp-row {
    display: grid;
    grid-template-columns: 1fr .65fr auto;
    gap: .4rem;
    align-items: center;
  }
  @media (max-width: 500px) {
    .insp-row { grid-template-columns: 1fr auto; }
    .insp-label { display: none; }
  }

  /* ── Shared buttons ── */
  .btn-add {
    background: none;
    border: 1px dashed var(--rule);
    border-radius: 3px;
    padding: .4rem .8rem;
    font-family: 'Lora', serif;
    font-size: .8rem;
    color: var(--muted);
    cursor: pointer;
    align-self: flex-start;
    transition: border-color .15s, color .15s;
    margin-top: .2rem;
  }
  .btn-add:hover { border-color: var(--copper); color: var(--copper); }

  .btn-remove {
    background: none;
    border: 1px solid var(--rule);
    border-radius: 2px;
    width: 1.5rem;
    height: 1.5rem;
    cursor: pointer;
    color: var(--muted);
    font-size: .85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color .15s, border-color .15s;
    flex-shrink: 0;
    padding: 0;
  }
  .btn-remove:hover:not(:disabled) { color: #c0392b; border-color: #c0392b; }
  .btn-remove:disabled { opacity: .3; cursor: default; }

  .btn-move {
    background: none;
    border: 1px solid var(--rule);
    border-radius: 2px;
    width: 1.5rem;
    height: 1.4rem;
    cursor: pointer;
    color: var(--muted);
    font-size: .7rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color .15s, border-color .15s;
    padding: 0;
  }
  .btn-move:hover:not(:disabled) { color: var(--ink); border-color: var(--ink); }
  .btn-move:disabled { opacity: .25; cursor: default; }

  /* ── YAML preview ── */
  .yaml-section { overflow: hidden; }

  .yaml-meta {
    font-family: 'Lora', serif;
    font-size: .72rem;
    color: var(--muted);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    display: flex;
    align-items: center;
    gap: .5rem;
  }

  .yaml-warn {
    color: #b5771a;
    font-style: italic;
  }

  .yaml-chevron {
    font-size: .65rem;
    color: var(--muted);
  }

  .yaml-body { padding: .6rem .9rem; }

  .yaml-pre {
    background: var(--ink);
    color: var(--paper);
    font-size: .72rem;
    padding: .85rem 1rem;
    border-radius: 3px;
    overflow-x: auto;
    line-height: 1.65;
    margin: 0;
    font-family: 'Courier New', monospace;
    white-space: pre;
  }

  /* ── CTA propose ── */
  .propose-bar {
    position: sticky;
    bottom: 0;
    background: var(--paper);
    border-top: 2px solid var(--copper);
    padding: .8rem 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .propose-hint {
    font-family: 'Lora', serif;
    font-size: .78rem;
    color: var(--muted);
    font-style: italic;
    flex: 1;
    min-width: 0;
  }
  .propose-hint--ready { color: var(--forest); font-style: normal; }
  .propose-hint code {
    font-family: 'Courier New', monospace;
    font-size: .72rem;
    background: rgba(45,66,40,.08);
    padding: .1rem .3rem;
    border-radius: 2px;
  }

  .btn-propose {
    background: var(--forest);
    color: var(--paper);
    border: none;
    border-radius: 3px;
    padding: .6rem 1.4rem;
    font-family: 'Playfair Display', serif;
    font-size: .9rem;
    cursor: pointer;
    transition: background .15s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-propose:hover:not(:disabled) { background: var(--fern); }
  .btn-propose:disabled { opacity: .4; cursor: default; }
</style>
