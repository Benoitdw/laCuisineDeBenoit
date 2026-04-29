<script lang="ts">
  interface PresetOption {
    id: string;
    label: string;
  }

  interface FarineSecondaire {
    id: string;
    type: string;
    g: string;
  }

  const { presets = [] }: { presets: PresetOption[] } = $props();

  // ── Helpers ───────────────────────────────────────────────────────────────
  function makeFlour(): FarineSecondaire {
    return { id: crypto.randomUUID(), type: '', g: '' };
  }

  function escapeYaml(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let date              = $state(new Date().toISOString().split('T')[0]);
  let titre             = $state('');
  let farine_principale = $state('T65');
  let farine_g          = $state('500');
  let farines_sec       = $state<FarineSecondaire[]>([]);
  let eau_g             = $state('375');
  let sel_g             = $state('10');
  let levure            = $state('levain');
  let levure_custom     = $state('');
  let levure_g                  = $state('');
  let levain_mere_g             = $state('');
  let levain_mere_hydration     = $state('');
  let levain_rafraichi_eau_g    = $state('');
  let levain_rafraichi_farine_g = $state('');
  let autres            = $state('');
  let poids_g           = $state('');
  let preset_id         = $state('');
  let note              = $state(3);
  let avis              = $state('');
  let photos            = $state<string[]>([]);

  let showYamlPreview   = $state(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const farineTotal = $derived(
    (parseFloat(farine_g) || 0) +
    farines_sec.reduce((s, f) => s + (parseFloat(f.g) || 0), 0)
  );

  const levainMereG           = $derived(levure === 'levain' ? (parseFloat(levain_mere_g) || 0) : 0);
  const levainMereHydration   = $derived(levure === 'levain' ? (parseFloat(levain_mere_hydration) || 0) : 0);
  const levainRafraiciEauG    = $derived(levure === 'levain' ? (parseFloat(levain_rafraichi_eau_g) || 0) : 0);
  const levainRafraiciFarineG = $derived(levure === 'levain' ? (parseFloat(levain_rafraichi_farine_g) || 0) : 0);

  const levainMereFarineG = $derived(
    levainMereG > 0 && levainMereHydration > 0 ? levainMereG / (1 + levainMereHydration / 100) : 0
  );
  const levainMereEauG    = $derived(levainMereG > 0 ? levainMereG - levainMereFarineG : 0);
  const levainEauTotal    = $derived(levainMereEauG + levainRafraiciEauG);
  const levainFarineTotal = $derived(levainMereFarineG + levainRafraiciFarineG);
  const levainTotal       = $derived(levainMereG + levainRafraiciEauG + levainRafraiciFarineG);

  const hydratation = $derived(
    (farineTotal + levainFarineTotal) > 0
      ? (((parseFloat(eau_g) || 0) + levainEauTotal) / (farineTotal + levainFarineTotal) * 100).toFixed(1)
      : null
  );

  const facteurReel = $derived(() => {
    const p = parseFloat(poids_g);
    const levureKg = levure === 'levain' ? levainTotal : (levure_g ? (parseFloat(levure_g) || 0) : 0);
    const base = farineTotal + (parseFloat(eau_g) || 0) + (parseFloat(sel_g) || 0) + levureKg;
    return p > 0 && base > 0 ? (p / base).toFixed(2) : null;
  });

  const levureLabel = $derived(levure === 'autre' ? levure_custom : levure);

  const canPropose = $derived(
    date !== '' &&
    farine_principale.trim() !== '' &&
    (parseFloat(farine_g) || 0) > 0 &&
    (parseFloat(eau_g) || 0) > 0 &&
    (parseFloat(sel_g) || 0) > 0 &&
    levureLabel.trim() !== '' &&
    avis.trim() !== ''
  );

  const yamlContent = $derived(buildYaml());

  // ── YAML ──────────────────────────────────────────────────────────────────
  function buildYaml(): string {
    const lines: string[] = ['---'];

    lines.push(`date: ${date}`);
    if (titre.trim()) lines.push(`titre: "${escapeYaml(titre.trim())}"`);
    lines.push(`farine_principale: "${escapeYaml(farine_principale)}"`);
    lines.push(`farine_g: ${parseFloat(farine_g) || 0}`);

    const validSec = farines_sec.filter(f => f.type.trim() !== '' && (parseFloat(f.g) || 0) > 0);
    if (validSec.length > 0) {
      lines.push('farines_secondaires:');
      for (const f of validSec) {
        lines.push(`  - type: "${escapeYaml(f.type)}"`);
        lines.push(`    g: ${parseFloat(f.g) || 0}`);
      }
    }

    lines.push(`eau_g: ${parseFloat(eau_g) || 0}`);
    lines.push(`sel_g: ${parseFloat(sel_g) || 0}`);
    lines.push(`levure: "${escapeYaml(levureLabel)}"`);
    if (levure !== 'levain' && levure_g && parseFloat(levure_g) > 0) {
      lines.push(`levure_g: ${parseFloat(levure_g)}`);
    }
    if (levure === 'levain') {
      if (levain_mere_g && parseFloat(levain_mere_g) > 0) {
        lines.push(`levain_mere_g: ${parseFloat(levain_mere_g)}`);
      }
      if (levain_mere_hydration && parseFloat(levain_mere_hydration) > 0) {
        lines.push(`levain_mere_hydration: ${parseFloat(levain_mere_hydration)}`);
      }
      if (levain_rafraichi_eau_g && parseFloat(levain_rafraichi_eau_g) > 0) {
        lines.push(`levain_rafraichi_eau_g: ${parseFloat(levain_rafraichi_eau_g)}`);
      }
      if (levain_rafraichi_farine_g && parseFloat(levain_rafraichi_farine_g) > 0) {
        lines.push(`levain_rafraichi_farine_g: ${parseFloat(levain_rafraichi_farine_g)}`);
      }
    }
    if (poids_g && parseFloat(poids_g) > 0) {
      lines.push(`poids_g: ${parseFloat(poids_g)}`);
    }
    if (autres.trim()) lines.push(`autres: "${escapeYaml(autres.trim())}"`);
    if (preset_id) lines.push(`preset: "${preset_id}"`);
    const validPhotos = photos.filter(p => p.trim() !== '');
    if (validPhotos.length > 0) {
      lines.push('photos:');
      for (const p of validPhotos) {
        lines.push(`  - "${escapeYaml(p)}"`);
      }
    }
    lines.push(`note: ${note}`);
    lines.push(`avis: "${escapeYaml(avis)}"`);
    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  // ── Farines secondaires ───────────────────────────────────────────────────
  function addFarine() {
    farines_sec = [...farines_sec, makeFlour()];
  }

  function removeFarine(i: number) {
    farines_sec = farines_sec.filter((_, idx) => idx !== i);
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  function addPhoto() {
    const n = photos.length + 1;
    const pad = n.toString().padStart(2, '0');
    photos = [...photos, `/images/pain/${date}-${pad}.png`];
  }

  function removePhoto(i: number) {
    photos = photos.filter((_, idx) => idx !== i);
  }

  // ── GitHub ────────────────────────────────────────────────────────────────
  function proposeFournee() {
    if (!canPropose) return;
    const base = 'https://github.com/Benoitdw/laCuisineDeBenoit/new/master';
    const params = new URLSearchParams({
      filename: `src/content/pain/${date}.md`,
      value: yamlContent,
      message: `feat: nouvelle fournée ${date}`,
    });
    window.open(`${base}?${params}`, '_blank');
  }
</script>

<!-- ── Template ─────────────────────────────────────────────────────────── -->

<div class="formulaire">

  <!-- 1. Date & titre -->
  <div class="form-section">
    <div class="section-title">Fournée</div>
    <div class="section-body">
      <div class="row-2">
        <div class="field">
          <label class="field-label" for="f-date">Date *</label>
          <input
            id="f-date"
            class="field-input"
            type="date"
            value={date}
            oninput={(e) => { date = (e.target as HTMLInputElement).value; }}
          />
          <span class="field-hint">→ src/content/pain/<strong>{date}.md</strong></span>
        </div>
        <div class="field">
          <label class="field-label" for="f-titre">Titre <span class="optional">(optionnel)</span></label>
          <input
            id="f-titre"
            class="field-input"
            type="text"
            value={titre}
            oninput={(e) => { titre = (e.target as HTMLInputElement).value; }}
            placeholder="ex. Pain de campagne rustique"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- 2. Farines -->
  <div class="form-section">
    <div class="section-title">Farines</div>
    <div class="section-body">
      <div class="row-2">
        <div class="field">
          <label class="field-label" for="f-farine">Farine principale *</label>
          <input
            id="f-farine"
            class="field-input"
            type="text"
            value={farine_principale}
            oninput={(e) => { farine_principale = (e.target as HTMLInputElement).value; }}
            placeholder="T65, T80, Épeautre…"
          />
        </div>
        <div class="field">
          <label class="field-label" for="f-farine-g">Quantité (g) *</label>
          <input
            id="f-farine-g"
            class="field-input"
            type="number" min="0"
            value={farine_g}
            oninput={(e) => { farine_g = (e.target as HTMLInputElement).value; }}
            placeholder="500"
          />
        </div>
      </div>

      {#if farines_sec.length > 0}
        <div class="farine-sec-header">
          <span>Farine secondaire</span>
          <span>Quantité (g)</span>
        </div>
      {/if}

      {#each farines_sec as f, i (f.id)}
        <div class="farine-sec-row">
          <input
            class="field-input"
            type="text"
            value={f.type}
            oninput={(e) => { farines_sec[i].type = (e.target as HTMLInputElement).value; }}
            placeholder="Seigle, Blé complet…"
          />
          <input
            class="field-input"
            type="number" min="0"
            value={f.g}
            oninput={(e) => { farines_sec[i].g = (e.target as HTMLInputElement).value; }}
            placeholder="100"
          />
          <button
            class="btn-remove"
            type="button"
            onclick={() => removeFarine(i)}
            aria-label="Supprimer"
          >×</button>
        </div>
      {/each}

      <button class="btn-add" type="button" onclick={addFarine}>
        + Farine secondaire
      </button>

      {#if farineTotal > 0}
        <div class="farine-total">
          Farine totale : <strong>{farineTotal} g</strong>
        </div>
      {/if}
    </div>
  </div>

  <!-- 3. Eau, sel, hydratation -->
  <div class="form-section">
    <div class="section-title">Eau & Sel</div>
    <div class="section-body">
      <div class="row-2">
        <div class="field">
          <label class="field-label" for="f-eau">Eau (g) *</label>
          <input
            id="f-eau"
            class="field-input"
            type="number" min="0"
            value={eau_g}
            oninput={(e) => { eau_g = (e.target as HTMLInputElement).value; }}
            placeholder="375"
          />
        </div>
        <div class="field">
          <label class="field-label" for="f-sel">Sel (g) *</label>
          <input
            id="f-sel"
            class="field-input"
            type="number" min="0" step="0.5"
            value={sel_g}
            oninput={(e) => { sel_g = (e.target as HTMLInputElement).value; }}
            placeholder="10"
          />
        </div>
      </div>
      {#if hydratation !== null}
        <div class="hydrat-badge">
          Hydratation : <strong>{hydratation} %</strong>
        </div>
      {/if}
    </div>
  </div>

  <!-- 4. Levure -->
  <div class="form-section">
    <div class="section-title">Levure</div>
    <div class="section-body">
      <div class="field">
        <label class="field-label">Type *</label>
        <div class="levure-group">
          {#each ['levain', 'levure sèche', 'levure fraîche', 'autre'] as l}
            <label class="radio-label" class:active={levure === l}>
              <input
                type="radio"
                name="levure"
                value={l}
                checked={levure === l}
                onchange={() => { levure = l; }}
              />
              {l}
            </label>
          {/each}
        </div>
        {#if levure === 'autre'}
          <input
            class="field-input"
            type="text"
            value={levure_custom}
            oninput={(e) => { levure_custom = (e.target as HTMLInputElement).value; }}
            placeholder="Précisez…"
          />
        {/if}
      </div>
      {#if levure !== 'levain'}
        <div class="field">
          <label class="field-label" for="f-levure-g">Quantité (g) <span class="optional">(optionnel)</span></label>
          <input
            id="f-levure-g"
            class="field-input field-input--short"
            type="number" min="0" step="0.5"
            value={levure_g}
            oninput={(e) => { levure_g = (e.target as HTMLInputElement).value; }}
            placeholder="4"
          />
        </div>
      {/if}
      {#if levure === 'levain'}
        <div class="field">
          <label class="field-label">Levain mère</label>
          <div class="row-2">
            <div class="field">
              <label class="field-label field-label--sub" for="f-levain-mere-g">Quantité (g)</label>
              <input
                id="f-levain-mere-g"
                class="field-input"
                type="number" min="0"
                value={levain_mere_g}
                oninput={(e) => { levain_mere_g = (e.target as HTMLInputElement).value; }}
                placeholder="20"
              />
            </div>
            <div class="field">
              <label class="field-label field-label--sub" for="f-levain-mere-hydration">Hydratation (%)</label>
              <input
                id="f-levain-mere-hydration"
                class="field-input"
                type="number" min="0" max="200"
                value={levain_mere_hydration}
                oninput={(e) => { levain_mere_hydration = (e.target as HTMLInputElement).value; }}
                placeholder="100"
              />
            </div>
          </div>
          {#if levainMereG > 0 && levainMereHydration > 0}
            <span class="field-hint">{levainMereFarineG.toFixed(1)} g farine + {levainMereEauG.toFixed(1)} g eau</span>
          {/if}
        </div>
        <div class="field">
          <label class="field-label">Rafraîchi <span class="optional">(optionnel)</span></label>
          <div class="row-2">
            <div class="field">
              <label class="field-label field-label--sub" for="f-rafraichi-eau">Eau (g)</label>
              <input
                id="f-rafraichi-eau"
                class="field-input"
                type="number" min="0"
                value={levain_rafraichi_eau_g}
                oninput={(e) => { levain_rafraichi_eau_g = (e.target as HTMLInputElement).value; }}
                placeholder="60"
              />
            </div>
            <div class="field">
              <label class="field-label field-label--sub" for="f-rafraichi-farine">Farine (g)</label>
              <input
                id="f-rafraichi-farine"
                class="field-input"
                type="number" min="0"
                value={levain_rafraichi_farine_g}
                oninput={(e) => { levain_rafraichi_farine_g = (e.target as HTMLInputElement).value; }}
                placeholder="100"
              />
            </div>
          </div>
          {#if levainTotal > 0}
            <span class="field-hint">Total levain : {levainTotal.toFixed(0)} g</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- 5. Divers -->
  <div class="form-section">
    <div class="section-title">Divers <span class="optional">(optionnel)</span></div>
    <div class="section-body">
      <div class="field">
        <label class="field-label" for="f-autres">Autres ingrédients</label>
        <input
          id="f-autres"
          class="field-input"
          type="text"
          value={autres}
          oninput={(e) => { autres = (e.target as HTMLInputElement).value; }}
          placeholder="Graines, huile, miel…"
        />
      </div>
      <div class="row-2">
        <div class="field">
          <label class="field-label" for="f-poids">Poids sorti du four (g)</label>
          <input
            id="f-poids"
            class="field-input"
            type="number" min="0"
            value={poids_g}
            oninput={(e) => { poids_g = (e.target as HTMLInputElement).value; }}
            placeholder="750"
          />
          {#if facteurReel()}
            <span class="field-hint">Facteur réel : ×{facteurReel()}</span>
          {/if}
        </div>
        <div class="field">
          <label class="field-label" for="f-preset">Preset Levainier</label>
          <select
            id="f-preset"
            class="field-input"
            value={preset_id}
            onchange={(e) => { preset_id = (e.target as HTMLSelectElement).value; }}
          >
            <option value="">— aucun —</option>
            {#each presets as p}
              <option value={p.id}>{p.label}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- 6. Photos -->
  <div class="form-section">
    <div class="section-title">Photos <span class="optional">(optionnel)</span></div>
    <div class="section-body">
      <p class="photos-note">
        Les chemins sont intégrés dans le YAML. Les fichiers eux-mêmes doivent être
        <strong>uploadés séparément</strong> dans
        <code>public/images/pain/</code> via GitHub.
      </p>

      {#each photos as photo, i}
        <div class="simple-row">
          <input
            class="field-input"
            type="text"
            value={photo}
            oninput={(e) => { photos[i] = (e.target as HTMLInputElement).value; }}
            placeholder="/images/pain/YYYY-MM-DD-01.png"
          />
          <button
            class="btn-remove"
            type="button"
            onclick={() => removePhoto(i)}
            aria-label="Supprimer"
          >×</button>
        </div>
      {/each}

      <button class="btn-add" type="button" onclick={addPhoto}>
        + Ajouter une photo
      </button>
    </div>
  </div>

  <!-- 7. Note & avis -->
  <div class="form-section">
    <div class="section-title">Évaluation</div>
    <div class="section-body">
      <div class="field">
        <label class="field-label">Note *</label>
        <div class="stars-row">
          {#each [1, 2, 3, 4, 5] as n}
            <button
              class="star-btn"
              class:on={n <= note}
              type="button"
              onclick={() => { note = n; }}
              aria-label="Note {n}/5"
            >★</button>
          {/each}
          <span class="note-label">{note}/5</span>
        </div>
      </div>
      <div class="field">
        <label class="field-label" for="f-avis">Avis *</label>
        <textarea
          id="f-avis"
          class="field-input field-textarea"
          rows="3"
          value={avis}
          oninput={(e) => { avis = (e.target as HTMLTextAreaElement).value; }}
          placeholder="Notes sur la texture, la croûte, ce qui a bien ou moins bien marché…"
        ></textarea>
      </div>
    </div>
  </div>

  <!-- 7. Aperçu YAML -->
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
          <span class="yaml-warn">⚠ URL longue</span>
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

  <!-- 8. CTA -->
  <div class="propose-bar">
    {#if !canPropose}
      <span class="propose-hint">Requis : date, farine, eau, sel, levure, avis</span>
    {:else}
      <span class="propose-hint propose-hint--ready">
        Prêt — fichier : <code>src/content/pain/{date}.md</code>
        {#if hydratation !== null}
          · {hydratation} % d'hydratation
        {/if}
      </span>
    {/if}
    <button
      class="btn-propose"
      type="button"
      onclick={proposeFournee}
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
    padding-bottom: 6rem;
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

  .field-label--sub {
    font-size: .72rem;
    font-weight: 500;
    color: var(--muted);
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

  .field-input--short { max-width: 140px; }

  .field-textarea {
    resize: vertical;
    min-height: 4rem;
  }

  select.field-input { cursor: pointer; }

  /* ── Row-2 ── */
  .row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: .65rem;
  }
  @media (max-width: 480px) {
    .row-2 { grid-template-columns: 1fr; }
  }

  /* ── Farines secondaires ── */
  .farine-sec-header {
    display: grid;
    grid-template-columns: 1fr 7rem;
    gap: .4rem;
    padding-bottom: .2rem;
    border-bottom: 1px solid var(--rule);
  }
  .farine-sec-header span {
    font-family: 'Lora', serif;
    font-size: .7rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .05em;
  }

  .farine-sec-row {
    display: grid;
    grid-template-columns: 1fr 7rem auto;
    gap: .4rem;
    align-items: center;
  }

  .farine-total {
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--muted);
    font-style: italic;
    padding-top: .1rem;
  }
  .farine-total strong { color: var(--forest); font-style: normal; }

  /* ── Hydratation badge ── */
  .hydrat-badge {
    display: inline-flex;
    align-items: center;
    gap: .4rem;
    background: rgba(45,66,40,.08);
    border: 1px solid rgba(45,66,40,.2);
    border-radius: 3px;
    padding: .35rem .7rem;
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--muted);
    align-self: flex-start;
  }
  .hydrat-badge strong { color: var(--forest); font-size: .95rem; }

  /* ── Levure radios ── */
  .levure-group {
    display: flex;
    gap: .45rem;
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

  /* ── Stars ── */
  .stars-row {
    display: flex;
    align-items: center;
    gap: .2rem;
  }

  .star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.55rem;
    color: var(--rule);
    padding: 0;
    line-height: 1;
    transition: color .1s, transform .1s;
  }
  .star-btn.on { color: var(--copper); }
  .star-btn:hover { transform: scale(1.15); }

  .note-label {
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--muted);
    margin-left: .4rem;
    font-style: italic;
  }

  /* ── Simple row ── */
  .simple-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: .4rem;
    align-items: center;
  }

  /* ── Photos note ── */
  .photos-note {
    font-family: 'Lora', serif;
    font-size: .8rem;
    color: var(--muted);
    font-style: italic;
    line-height: 1.55;
    border-left: 2px solid var(--copper);
    padding-left: .65rem;
    margin: 0;
  }
  .photos-note strong { font-style: normal; color: var(--ink); }
  .photos-note code {
    font-family: 'Courier New', monospace;
    font-size: .75rem;
    background: rgba(45,66,40,.08);
    padding: .05rem .3rem;
    border-radius: 2px;
    font-style: normal;
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
    margin-top: .1rem;
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
    padding: 0;
    flex-shrink: 0;
  }
  .btn-remove:hover { color: #c0392b; border-color: #c0392b; }

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

  .yaml-warn { color: #b5771a; font-style: italic; }
  .yaml-chevron { font-size: .65rem; color: var(--muted); }

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

  /* ── CTA ── */
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
