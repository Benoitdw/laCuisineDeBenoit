<script lang="ts">
  export let pains: Array<{
    id: string;
    data: {
      date: string;
      titre?: string;
      farine_principale: string;
      farine_secondaire?: string;
      farine_g: number;
      eau_g: number;
      sel_g: number;
      levure: string;
      levure_g?: number;
      autres?: string;
      note: number;
      avis: string;
      photo?: string;
    };
  }> = [];

  let selected: typeof pains[0] | null = null;

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
            <td>{p.data.farine_secondaire || '—'}</td>
            <td class="num">{pct(p.data.eau_g, p.data.farine_g)} %</td>
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

      {#if selected.data.photo}
        <img src={selected.data.photo} alt={label(selected)} class="modal-photo" />
      {/if}

      <table class="detail-table">
        <thead>
          <tr><th>Ingrédient</th><th class="num">Grammes</th><th class="num">%</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Farine ({selected.data.farine_principale}{selected.data.farine_secondaire ? ' + ' + selected.data.farine_secondaire : ''})</td>
            <td class="num">{selected.data.farine_g} g</td>
            <td class="num">100 %</td>
          </tr>
          <tr>
            <td>Eau</td>
            <td class="num">{selected.data.eau_g} g</td>
            <td class="num">{pct(selected.data.eau_g, selected.data.farine_g)} %</td>
          </tr>
          <tr>
            <td>Sel</td>
            <td class="num">{selected.data.sel_g} g</td>
            <td class="num">{pct(selected.data.sel_g, selected.data.farine_g)} %</td>
          </tr>
          {#if selected.data.levure_g !== undefined}
            <tr>
              <td>Levure ({selected.data.levure})</td>
              <td class="num">{selected.data.levure_g} g</td>
              <td class="num">{pct(selected.data.levure_g, selected.data.farine_g)} %</td>
            </tr>
          {:else}
            <tr>
              <td>Levure ({selected.data.levure})</td>
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

  .modal-photo {
    width: 100%;
    border-radius: 3px;
    margin-bottom: 1.25rem;
    display: block;
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
</style>
