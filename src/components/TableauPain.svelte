<script lang="ts">
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  export let pains: Array<{
    id: string;
    data: {
      date: string;
      titre?: string;
      farine_principale: string;
      farine_g: number;
      farines_secondaires?: { type: string; g: number }[];
      eau_g: number;
      sel_g: number;
      levure: string;
      levure_g?: number;
      levain_eau_g?: number;
      levain_farine_g?: number;
      autres?: string;
      poids_g?: number;
      note: number;
      avis: string;
      photos?: string[];
      preset?: string;
    };
  }> = [];

  let selected: typeof pains[0] | null = null;
  let cible = 0;

  function farineTotal(d: typeof pains[0]['data']) {
    return d.farine_g + (d.farines_secondaires?.reduce((s, f) => s + f.g, 0) ?? 0);
  }

  $: if (selected) {
    const base = farineTotal(selected.data) + selected.data.eau_g + selected.data.sel_g + (selected.data.levure_g ?? 0);
    cible = selected.data.poids_g ?? base;
  }

  $: poidsBase = selected
    ? farineTotal(selected.data) + selected.data.eau_g + selected.data.sel_g + (selected.data.levure_g ?? 0)
    : 1;

  $: facteur = poidsBase > 0 ? cible / poidsBase : 1;

  function ajuster(delta: number) {
    cible = Math.max(300, cible + delta);
  }

  function etoiles(n: number) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function pct(val: number, farine: number) {
    return (val / farine * 100).toFixed(1);
  }

  function label(p: typeof pains[0]) {
    return p.data.titre || formatDate(p.data.date);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function open(p: typeof pains[0]) { selected = p; }
  function close() { selected = null; }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if pains.length === 0}
  <p class="vide">Aucune fournée enregistrée pour l'instant.</p>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Titre</th>
          <th>Farine princ.</th>
          <th>Farine sec.</th>
          <th class="num">Hydrat.</th>
          <th class="num">Sel</th>
          <th>Levure</th>
          <th>Autres</th>
          <th class="num">Note</th>
        </tr>
      </thead>
      <tbody>
        {#each pains as p}
          <tr class="row" on:click={() => open(p)}>
            <td class="date">{formatDate(p.data.date)}</td>
            <td class="titre">{p.data.titre || '—'}</td>
            <td>{p.data.farine_principale}</td>
            <td>{p.data.farines_secondaires?.map(f => f.type).join(', ') || '—'}</td>
            <td class="num">{pct(p.data.eau_g + (p.data.levain_eau_g ?? 0), farineTotal(p.data) + (p.data.levain_farine_g ?? 0))} %</td>
            <td class="num">{pct(p.data.sel_g, p.data.farine_g)} %</td>
            <td>{p.data.levure}</td>
            <td class="autres">{p.data.autres || '—'}</td>
            <td class="num etoiles">{etoiles(p.data.note)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if selected}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="modal" on:click|stopPropagation>
      <button class="close" on:click={close} aria-label="Fermer">×</button>

      <h2>{label(selected)}</h2>
      <p class="modal-date">{formatDate(selected.data.date)}</p>

      {#if selected.data.photos && selected.data.photos.length > 0}
        <div class="galerie">
          {#each selected.data.photos as src, i}
            <img src="{base}{src}" alt="{label(selected)} photo {i + 1}" class="galerie-img" />
          {/each}
        </div>
      {/if}

      <!-- Calculateur de poids -->
      <div class="calculateur">
        <span class="calc-label">Poids cible :</span>
        <div class="calc-controls">
          <button class="calc-btn" on:click={() => ajuster(-100)}>− 100 g</button>
          <span class="calc-val">{cible} g</span>
          <button class="calc-btn" on:click={() => ajuster(100)}>+ 100 g</button>
        </div>
        {#if facteur !== 1}
          <span class="calc-hint">(× {facteur.toFixed(2)})</span>
        {/if}
      </div>

      <table class="detail-table">
        <thead>
          <tr><th>Ingrédient</th><th class="num">Grammes</th><th class="num">%</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Farine {selected.data.farine_principale}</td>
            <td class="num">{Math.round(selected.data.farine_g * facteur)} g</td>
            <td class="num">{pct(selected.data.farine_g, farineTotal(selected.data))} %</td>
          </tr>
          {#each selected.data.farines_secondaires ?? [] as f}
            <tr>
              <td>Farine {f.type}</td>
              <td class="num">{Math.round(f.g * facteur)} g</td>
              <td class="num">{pct(f.g, farineTotal(selected.data))} %</td>
            </tr>
          {/each}
          <tr>
            <td>Eau</td>
            <td class="num">{Math.round(selected.data.eau_g * facteur)} g</td>
            <td class="num">{pct(selected.data.eau_g, farineTotal(selected.data))} %</td>
          </tr>
          <tr>
            <td>Sel</td>
            <td class="num">{Math.round(selected.data.sel_g * facteur)} g</td>
            <td class="num">{pct(selected.data.sel_g, farineTotal(selected.data))} %</td>
          </tr>
          {#if selected.data.levure_g !== undefined}
            <tr>
              <td>
                {#if selected.data.levure === 'levain' && selected.data.levain_eau_g !== undefined && selected.data.levain_farine_g !== undefined}
                  levain ({(selected.data.levain_eau_g / selected.data.levain_farine_g * 100).toFixed(0)} %)
                {:else}
                  Levure ({selected.data.levure})
                {/if}
              </td>
              <td class="num">{Math.round(selected.data.levure_g * facteur)} g</td>
              <td class="num">{pct(selected.data.levure_g, farineTotal(selected.data))} %</td>
            </tr>
          {:else}
            <tr>
              <td>
                {#if selected.data.levure === 'levain' && selected.data.levain_eau_g !== undefined && selected.data.levain_farine_g !== undefined}
                  levain ({(selected.data.levain_eau_g / selected.data.levain_farine_g * 100).toFixed(0)} %)
                {:else}
                  Levure ({selected.data.levure})
                {/if}
              </td>
              <td class="num">—</td>
              <td class="num">—</td>
            </tr>
          {/if}
          {#if selected.data.autres}
            <tr>
              <td>Autres</td>
              <td class="num" colspan="2">{selected.data.autres}</td>
            </tr>
          {/if}
        </tbody>
      </table>

      <div class="modal-avis">
        <p class="avis-text">{selected.data.avis}</p>
      </div>

      <p class="modal-note">{etoiles(selected.data.note)} <span class="note-num">{selected.data.note}/5</span></p>

      <div class="chrono-link-wrap">
        <a
          href="{base}/pain/chrono?preset={selected.data.preset ?? 'levain'}"
          class="chrono-link"
        >
          Lancer le chrono →
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  .vide {
    font-style: italic;
    color: var(--ink-lt, #888);
    padding: 2rem 0;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Lora', serif;
    font-size: .88rem;
  }

  thead th {
    font-family: 'Playfair Display', serif;
    font-size: .75rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--copper, #b87333);
    border-bottom: 2px solid var(--copper, #b87333);
    padding: .55rem .75rem;
    text-align: left;
    white-space: nowrap;
  }

  thead th.num { text-align: right; }

  tbody tr.row {
    cursor: pointer;
    border-bottom: 1px solid rgba(0,0,0,.08);
    transition: background .15s;
  }

  tbody tr.row:hover {
    background: rgba(184,115,51,.07);
  }

  tbody td {
    padding: .55rem .75rem;
    color: var(--ink, #2c2c2c);
    vertical-align: middle;
  }

  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.date { white-space: nowrap; font-size: .82rem; color: var(--ink-lt, #888); }
  td.titre { font-weight: 500; }
  td.autres { font-size: .82rem; color: var(--ink-lt, #888); }
  td.etoiles { color: var(--copper, #b87333); letter-spacing: .1em; }

  /* Modale */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: var(--paper, #f5edd8);
    border-radius: 4px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 2rem;
    position: relative;
    box-shadow: 0 8px 40px rgba(0,0,0,.35);
  }

  .close {
    position: absolute;
    top: 1rem;
    right: 1.25rem;
    background: none;
    border: none;
    font-size: 1.6rem;
    cursor: pointer;
    color: var(--ink-lt, #888);
    line-height: 1;
    padding: 0;
  }
  .close:hover { color: var(--ink, #2c2c2c); }

  .modal h2 {
    font-family: 'Playfair Display', serif;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--forest, #2d4a3e);
    margin-bottom: .2rem;
    padding-right: 2rem;
  }

  .modal-date {
    font-size: .8rem;
    color: var(--ink-lt, #888);
    margin-bottom: 1.25rem;
  }

  /* Galerie photos */
  .galerie {
    display: flex;
    gap: .5rem;
    overflow-x: auto;
    margin-bottom: 1.25rem;
    border-radius: 3px;
  }

  .galerie-img {
    height: 160px;
    width: auto;
    min-width: 120px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
  }

  /* Calculateur */
  .calculateur {
    display: flex;
    align-items: center;
    gap: .75rem;
    flex-wrap: wrap;
    background: rgba(184,115,51,.08);
    border: 1px solid rgba(184,115,51,.2);
    border-radius: 3px;
    padding: .6rem 1rem;
    margin-bottom: 1rem;
    font-family: 'Lora', serif;
    font-size: .88rem;
  }

  .calc-label {
    color: var(--ink, #2c2c2c);
    font-style: italic;
  }

  .calc-controls {
    display: flex;
    align-items: center;
    gap: .5rem;
  }

  .calc-btn {
    background: var(--copper, #b87333);
    color: white;
    border: none;
    border-radius: 2px;
    padding: .25rem .65rem;
    font-size: .8rem;
    cursor: pointer;
    font-family: 'Lora', serif;
    transition: background .15s;
  }
  .calc-btn:hover { background: var(--copper-lt, #d4956a); }

  .calc-val {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: 1rem;
    color: var(--forest, #2d4a3e);
    min-width: 4.5rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .calc-hint {
    font-size: .78rem;
    color: var(--ink-lt, #888);
    font-style: italic;
  }

  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: .88rem;
    margin-bottom: 1.25rem;
  }

  .detail-table thead th {
    font-family: 'Playfair Display', serif;
    font-size: .72rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--copper, #b87333);
    border-bottom: 1px solid var(--copper, #b87333);
    padding: .4rem .5rem;
  }

  .detail-table tbody td {
    padding: .4rem .5rem;
    border-bottom: 1px solid rgba(0,0,0,.07);
    color: var(--ink, #2c2c2c);
  }

  .detail-table td.num { text-align: right; font-variant-numeric: tabular-nums; }

  .modal-avis {
    border-left: 3px solid var(--copper, #b87333);
    padding-left: 1rem;
    margin-bottom: 1rem;
  }

  .avis-text {
    font-family: 'Lora', serif;
    font-style: italic;
    font-size: .95rem;
    line-height: 1.7;
    color: var(--ink, #2c2c2c);
  }

  .modal-note {
    font-size: 1.1rem;
    color: var(--copper, #b87333);
    letter-spacing: .1em;
  }

  .note-num {
    font-family: 'Playfair Display', serif;
    font-size: .85rem;
    color: var(--ink-lt, #888);
    margin-left: .4rem;
  }

  .chrono-link-wrap {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(0,0,0,.07);
    text-align: right;
  }

  .chrono-link {
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--copper, #b87333);
    text-decoration: none;
    letter-spacing: .03em;
    transition: color .15s;
  }
  .chrono-link:hover { color: var(--forest, #2d4a3e); }
</style>
