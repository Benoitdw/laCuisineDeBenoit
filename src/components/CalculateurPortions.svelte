<script lang="ts">
  const { portionsBase = 4, ingredients = [] }: {
    portionsBase?: number;
    ingredients?: Array<{
      nom: string;
      quantite?: number;
      unite?: string;
      note?: string;
      interchangeable?: boolean;
    }>;
  } = $props();

  let portions = $state(portionsBase);
  const facteur = $derived(portions / portionsBase);
  const indispensables = $derived(ingredients.filter(i => !i.interchangeable));
  const interchangeables = $derived(ingredients.filter(i => i.interchangeable));

  function hasQty(q?: number): boolean {
    return q !== undefined && q !== null && q !== 0;
  }

  function fmt(q: number, f: number, unite?: string): string {
    const v = q * f;
    if (Number.isInteger(q) && !unite) return String(Math.round(v));
    const r = parseFloat(v.toFixed(1));
    return Number.isInteger(r) ? String(r) : String(r);
  }
</script>

<div class="portions">
  <button class="p-btn" onclick={() => portions = Math.max(1, portions - 1)} aria-label="Moins">−</button>
  <span class="p-count">{portions}</span>
  <button class="p-btn" onclick={() => portions = Math.min(20, portions + 1)} aria-label="Plus">+</button>
  <span class="p-label">portions</span>
  {#if portions !== portionsBase}
    <span class="p-base">(base {portionsBase})</span>
  {/if}
</div>

<div class="ing-sep">
  <span class="ing-sep-label">Indispensables</span>
</div>

<ul class="ing-list">
  {#each indispensables as ing}
    <li class:no-qty={!hasQty(ing.quantite)}>
      {#if hasQty(ing.quantite)}
        <span class="ing-qty">{fmt(ing.quantite!, facteur, ing.unite)}</span>
        <span class="ing-unit">{ing.unite ?? ''}</span>
      {/if}
      <span class="ing-name">{ing.nom}</span>
      {#if ing.note}<span class="ing-note">{ing.note}</span>{/if}
    </li>
  {/each}
</ul>

{#if interchangeables.length > 0}
  <div class="ing-sep">
    <span class="ing-sep-label">Interchangeables</span>
  </div>
  <ul class="ing-list interchangeables">
    {#each interchangeables as ing}
      <li>
        <span class="ing-qty">{hasQty(ing.quantite) ? fmt(ing.quantite!, facteur, ing.unite) : ''}</span>
        <span class="ing-unit">{ing.unite ?? ''}</span>
        <span class="ing-name"><span class="swap-icon" aria-hidden="true">⇄</span>{ing.nom}</span>
        {#if ing.note}<span class="ing-note">{ing.note}</span>{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .portions {
    display: flex;
    align-items: center;
    gap: .45rem;
    margin-bottom: 1.1rem;
    font-size: .82rem;
    color: var(--muted);
  }
  .p-count {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--forest);
    min-width: 18px;
    text-align: center;
  }
  .p-btn {
    width: 20px; height: 20px;
    border-radius: 2px;
    border: 1px solid rgba(45,66,40,.25);
    background: transparent;
    color: var(--forest);
    font-size: .85rem;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s;
    line-height: 1;
  }
  .p-btn:hover { background: var(--fern-lt); }
  .p-label { color: var(--muted); }
  .p-base { font-style: italic; color: var(--muted); font-size: .72rem; }

  .ing-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .ing-list li {
    display: grid;
    grid-template-columns: 2.4rem auto 1fr;
    gap: .25rem;
    padding: .26rem 0;
    border-bottom: 1px solid rgba(28,22,14,.07);
    font-size: .87rem;
    align-items: baseline;
  }
  .ing-list li.no-qty .ing-name {
    grid-column: 1 / -1;
  }
  .ing-list li.no-qty .ing-note {
    grid-column: 1 / -1;
  }
  .ing-qty {
    font-family: 'Playfair Display', serif;
    font-weight: 600;
    color: var(--copper);
    text-align: right;
  }
  .ing-unit {
    font-style: italic;
    color: var(--muted);
    font-size: .78rem;
    padding: 0 .4rem;
    min-width: 1.5rem;
  }
  .ing-name { color: var(--ink); }
  .ing-note {
    grid-column: 3;
    font-style: italic;
    color: var(--muted);
    font-size: .73rem;
  }

  .ing-sep {
    margin: 1rem 0 .65rem;
    display: flex;
    align-items: center;
    gap: .5rem;
  }
  .ing-sep::before, .ing-sep::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--fern);
    opacity: .25;
  }
  .ing-sep-label {
    font-size: .67rem;
    color: var(--fern);
    letter-spacing: .12em;
    text-transform: uppercase;
    white-space: nowrap;
    font-style: italic;
    font-family: 'Lora', serif;
  }

  .interchangeables li {
    background: rgba(173,107,53,.04);
  }
  .interchangeables .ing-qty { color: rgba(173,107,53,.6); }
  .interchangeables .ing-name { color: rgba(173,107,53,.75); }

  .swap-icon {
    font-style: normal;
    margin-right: .25rem;
    font-size: .8rem;
    opacity: .7;
  }
</style>
