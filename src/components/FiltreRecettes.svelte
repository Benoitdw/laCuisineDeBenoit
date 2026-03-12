<script lang="ts">
  interface Recette {
    slug: string;
    data: {
      title: string;
      description: string;
      image?: string;
      categories: string[];
      tags: string[];
      difficulte: 'facile' | 'moyen' | 'difficile';
      temps_prep: number;
      temps_cuisson: number;
      vegetarien: boolean;
      vegan: boolean;
      date: string;
    };
  }

  export let recettes: Recette[] = [];
  export let base: string = '';

  const allTags = [...new Set(recettes.flatMap(r => r.data.tags))].sort();

  function getInitial() {
    if (typeof window === 'undefined') return { tags: [] as string[], difficulte: '', temps: '', vegetarien: false, vegan: false };
    const p = new URLSearchParams(window.location.search);
    return {
      tags: p.get('tags') ? p.get('tags')!.split(',') : [],
      difficulte: p.get('difficulte') || '',
      temps: p.get('temps') || '',
      vegetarien: p.get('vegetarien') === 'true',
      vegan: p.get('vegan') === 'true',
    };
  }
  const init = getInitial();
  let selectedTags: string[] = init.tags;
  let selectedDiff = init.difficulte;
  let selectedTemps = init.temps;
  let filtreVeg = init.vegetarien;
  let filtreVegan = init.vegan;

  function toggleTag(tag: string) {
    selectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
  }
  function reset() {
    selectedTags = []; selectedDiff = ''; selectedTemps = ''; filtreVeg = false; filtreVegan = false;
  }

  $: {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams();
      if (selectedTags.length) p.set('tags', selectedTags.join(','));
      if (selectedDiff) p.set('difficulte', selectedDiff);
      if (selectedTemps) p.set('temps', selectedTemps);
      if (filtreVeg) p.set('vegetarien', 'true');
      if (filtreVegan) p.set('vegan', 'true');
      window.history.replaceState({}, '', p.toString() ? `${window.location.pathname}?${p}` : window.location.pathname);
    }
  }

  $: filtrees = recettes.filter(r => {
    if (selectedTags.length && !selectedTags.every(t => r.data.tags.includes(t))) return false;
    if (selectedDiff && r.data.difficulte !== selectedDiff) return false;
    if (filtreVeg && !r.data.vegetarien) return false;
    if (filtreVegan && !r.data.vegan) return false;
    if (selectedTemps) {
      const total = r.data.temps_prep + r.data.temps_cuisson;
      if (selectedTemps === '30' && total > 30) return false;
      if (selectedTemps === '60' && total > 60) return false;
    }
    return true;
  });

  $: hasFiltre = selectedTags.length > 0 || selectedDiff || selectedTemps || filtreVeg || filtreVegan;
</script>

<!-- FILTER BAR -->
<div class="filters print:hidden">
  <div class="filters-inner">
    <span class="filter-label">Filtrer</span>

    <button class="f-btn" class:active={!selectedDiff && !selectedTemps && !filtreVeg && !filtreVegan && !selectedTags.length} on:click={reset}>Tous</button>

    <div class="f-sep"></div>

    {#each ['facile', 'moyen', 'difficile'] as d}
      <button class="f-btn" class:active={selectedDiff === d} on:click={() => selectedDiff = selectedDiff === d ? '' : d}>
        {d.charAt(0).toUpperCase() + d.slice(1)}
      </button>
    {/each}

    <div class="f-sep"></div>

    <button class="f-btn" class:active={selectedTemps === '30'} on:click={() => selectedTemps = selectedTemps === '30' ? '' : '30'}>≤ 30 min</button>
    <button class="f-btn" class:active={selectedTemps === '60'} on:click={() => selectedTemps = selectedTemps === '60' ? '' : '60'}>≤ 1 h</button>

    <div class="f-sep"></div>

    <button class="f-btn" class:active={filtreVegan} on:click={() => filtreVegan = !filtreVegan}>🌱 Vegan</button>
    <button class="f-btn" class:active={filtreVeg} on:click={() => filtreVeg = !filtreVeg}>🌿 Végétarien</button>
  </div>

  {#if allTags.length > 0}
    <div class="tags-bar">
      {#each allTags as tag}
        <button class="tag-btn" class:active={selectedTags.includes(tag)} on:click={() => toggleTag(tag)}>{tag}</button>
      {/each}
    </div>
  {/if}
</div>

<!-- RESULTS COUNT -->
<p class="count">
  {filtrees.length} recette{filtrees.length !== 1 ? 's' : ''}
  {#if hasFiltre}<button class="reset-link" on:click={reset}>— réinitialiser</button>{/if}
</p>

<!-- GRID -->
{#if filtrees.length === 0}
  <div class="empty">
    <p>Aucune recette ne correspond à ces critères.</p>
    <button on:click={reset} class="f-btn active" style="margin-top:.75rem">Afficher tout</button>
  </div>
{:else}
  <div class="grid">
    {#each filtrees as r}
      <a href="{base}/recettes/{r.slug}" class="card">

        {#if r.data.image}
          <div class="card-photo">
            <img src={r.data.image} alt={r.data.title} loading="lazy" />
          </div>
        {:else}
          <div class="card-placeholder">
            <svg width="38" height="50" viewBox="0 0 48 60" fill="none" aria-hidden="true">
              <path d="M24 56C24 44,23 32,24 12" stroke="#F5EDD8" stroke-width="1.2" fill="none"/>
              <path d="M24 44C16 38,10 39,8 33C14 31,20 35,24 44Z" fill="#F5EDD8"/>
              <path d="M24 30C32 24,38 25,40 19C34 17,28 21,24 30Z" fill="#F5EDD8"/>
              <path d="M24 44C32 38,38 39,40 33C34 31,28 35,24 44Z" fill="#F5EDD8"/>
              <path d="M24 30C16 24,10 25,8 19C14 17,20 21,24 30Z" fill="#F5EDD8"/>
            </svg>
            <span class="placeholder-cat">{r.data.categories[0] ?? ''}</span>
          </div>
        {/if}

        <div class="card-body">
          <div class="card-title">{r.data.title}</div>
          <div class="card-desc">{r.data.description}</div>
          <div class="card-meta">
            <span>⏱ {r.data.temps_prep + r.data.temps_cuisson} min</span>
            <span class="meta-sep">·</span>
            <span class="card-diff">{r.data.difficulte}</span>
            {#if r.data.vegan}<span class="meta-sep">·</span><span>🌱</span>{:else if r.data.vegetarien}<span class="meta-sep">·</span><span>🌿</span>{/if}
          </div>
          {#if r.data.tags.length}
            <div class="card-tags">
              {#each r.data.tags.slice(0, 3) as tag}
                <span class="card-tag">{tag}</span>
              {/each}
            </div>
          {/if}
        </div>

      </a>
    {/each}
  </div>
{/if}

<style>
  /* FILTERS */
  .filters { margin-bottom: 1.25rem; }
  .filters-inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .45rem;
    padding: .7rem 1rem;
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 3px;
    margin-bottom: .6rem;
  }
  .filter-label {
    font-size: .67rem;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: var(--muted);
    margin-right: .2rem;
    font-family: 'Lora', serif;
  }
  .f-btn {
    padding: .18rem .6rem;
    font-size: .75rem;
    font-family: 'Lora', serif;
    border: 1px solid var(--rule);
    border-radius: 2px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all .12s;
  }
  .f-btn:hover, .f-btn.active {
    background: var(--forest);
    color: var(--fern-lt);
    border-color: var(--forest);
  }
  .f-sep { width: 1px; height: 16px; background: var(--rule); }

  .tags-bar {
    display: flex;
    flex-wrap: wrap;
    gap: .35rem;
    padding: 0 .25rem;
  }
  .tag-btn {
    font-size: .7rem;
    font-family: 'Lora', serif;
    padding: .1rem .5rem;
    border: 1px solid var(--rule);
    border-radius: 2px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all .12s;
  }
  .tag-btn:hover, .tag-btn.active {
    background: var(--fern);
    color: var(--paper);
    border-color: var(--fern);
  }

  .count {
    font-size: .72rem;
    color: var(--muted);
    letter-spacing: .04em;
    text-transform: uppercase;
    margin-bottom: 1.25rem;
  }
  .reset-link {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--copper);
    font-size: .72rem;
    font-family: 'Lora', serif;
    letter-spacing: .04em;
    text-transform: uppercase;
    padding: 0;
  }
  .reset-link:hover { text-decoration: underline; }

  .empty { text-align: center; padding: 3rem 0; color: var(--muted); font-style: italic; }

  /* GRID */
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }
  @media (max-width: 680px) { .grid { grid-template-columns: 1fr; } }
  @media (min-width: 480px) and (max-width: 680px) { .grid { grid-template-columns: repeat(2,1fr); } }

  /* CARD */
  .card {
    background: var(--card);
    border: 1px solid var(--rule);
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    transition: box-shadow .15s, transform .15s;
  }
  .card:hover {
    box-shadow: 0 4px 20px rgba(28,22,14,.1);
    transform: translateY(-2px);
  }

  .card-photo {
    aspect-ratio: 2 / 1;
    overflow: hidden;
    flex-shrink: 0;
  }
  .card-photo img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
    transition: transform .3s;
  }
  .card:hover .card-photo img { transform: scale(1.04); }

  .card-placeholder {
    aspect-ratio: 2 / 1;
    background: var(--forest);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .5rem;
    flex-shrink: 0;
  }
  .placeholder-cat {
    font-size: .63rem;
    text-transform: uppercase;
    letter-spacing: .12em;
    color: rgba(245,237,216,.28);
    font-family: 'Lora', serif;
  }

  .card-body {
    padding: .9rem 1rem .85rem;
    display: flex;
    flex-direction: column;
    flex: 1;
    border-left: 2.5px solid var(--copper);
  }
  .card-title {
    font-family: 'Playfair Display', serif;
    font-size: .95rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.3;
    margin-bottom: .3rem;
  }
  .card:hover .card-title { color: var(--forest); }
  .card-desc {
    font-size: .77rem;
    color: var(--muted);
    font-style: italic;
    line-height: 1.5;
    margin-bottom: .7rem;
    flex: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .card-meta {
    display: flex;
    align-items: center;
    gap: .4rem;
    font-size: .7rem;
    color: var(--muted);
    flex-wrap: wrap;
  }
  .meta-sep { color: var(--rule); }
  .card-diff {
    font-size: .67rem;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--fern);
  }
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: .28rem;
    margin-top: .5rem;
  }
  .card-tag {
    font-size: .64rem;
    color: var(--muted);
    background: rgba(28,22,14,.04);
    border: 1px solid var(--rule);
    padding: .06rem .42rem;
    border-radius: 2px;
  }
</style>
