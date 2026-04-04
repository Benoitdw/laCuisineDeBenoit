<script lang="ts">
  import type { ChronoSection } from '../data/chronoPresets.ts';

  interface Props {
    sections: ChronoSection[];
    currentSectionIdx: number;
    currentStepIdx: number;
    checkedStepIds: Set<string>;
    elapsedSeconds: number;
    totalSeconds: number;
  }

  let {
    sections,
    currentSectionIdx,
    currentStepIdx,
    checkedStepIds,
    elapsedSeconds,
    totalSeconds,
  }: Props = $props();

  function sectionDuration(section: ChronoSection): number {
    return section.steps.reduce((sum, s) => sum + s.dureeMin * 60, 0);
  }

  function sectionStartSeconds(idx: number): number {
    let sum = 0;
    for (let i = 0; i < idx; i++) sum += sectionDuration(sections[i]);
    return sum;
  }

  const elapsedPct = $derived(totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0);
</script>

<div class="timeline">
  <!-- Barre de progression globale -->
  <div class="track" role="progressbar" aria-valuenow={Math.round(elapsedPct)} aria-valuemin={0} aria-valuemax={100}>
    <div class="progress-fill" style="width: {elapsedPct}%"></div>

    <!-- Sections -->
    {#each sections as section, si}
      {@const secDur = sectionDuration(section)}
      {@const secPct = totalSeconds > 0 ? (secDur / totalSeconds) * 100 : 0}
      {@const secStart = totalSeconds > 0 ? (sectionStartSeconds(si) / totalSeconds) * 100 : 0}
      <div
        class="section-block"
        class:active={si === currentSectionIdx}
        class:done={si < currentSectionIdx}
        style="left: {secStart}%; width: {secPct}%"
        title="{section.name}"
      >
        <!-- Step markers -->
        {#each section.steps as step, ti}
          {@const stepOffset = secDur > 0
            ? (section.steps.slice(0, ti).reduce((a, s) => a + s.dureeMin * 60, 0) / secDur) * 100
            : 0}
          {@const isDone = si < currentSectionIdx || (si === currentSectionIdx && ti < currentStepIdx)}
          {@const isCurrent = si === currentSectionIdx && ti === currentStepIdx}
          {@const isChecked = checkedStepIds.has(step.id)}
          <div
            class="step-dot"
            class:step-done={isDone}
            class:step-current={isCurrent}
            class:step-checked={isChecked}
            style="left: {stepOffset}%"
            title="{step.name} · {step.dureeMin} min"
          ></div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Étiquettes de sections -->
  <div class="section-labels">
    {#each sections as section, si}
      {@const secDur = sectionDuration(section)}
      {@const secPct = totalSeconds > 0 ? (secDur / totalSeconds) * 100 : 0}
      {@const secStart = totalSeconds > 0 ? (sectionStartSeconds(si) / totalSeconds) * 100 : 0}
      <div
        class="section-label"
        class:active={si === currentSectionIdx}
        class:done={si < currentSectionIdx}
        style="left: {secStart}%; width: {secPct}%"
      >
        {section.name}
      </div>
    {/each}
  </div>

  <!-- Étapes de la section active -->
  {#if currentSectionIdx >= 0 && sections[currentSectionIdx]}
    {@const sec = sections[currentSectionIdx]}
    <div class="step-labels">
      {#each sec.steps as step, ti}
        {@const isDone = ti < currentStepIdx}
        {@const isCurrent = ti === currentStepIdx}
        {@const isChecked = checkedStepIds.has(step.id)}
        <div
          class="step-label"
          class:step-label-done={isDone}
          class:step-label-current={isCurrent}
          class:step-label-checked={isChecked}
        >
          {#if isChecked}<span class="check-mark">✓</span>{/if}
          {step.name}
          <span class="step-dur">{step.dureeMin} min</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .timeline {
    width: 100%;
    user-select: none;
  }

  /* Track */
  .track {
    position: relative;
    height: 28px;
    background: rgba(28, 22, 14, .08);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 4px;
  }

  .progress-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, var(--copper, #AD6B35) 0%, rgba(173,107,53,.6) 100%);
    transition: width .5s linear;
    pointer-events: none;
  }

  /* Section blocks */
  .section-block {
    position: absolute;
    top: 0;
    bottom: 0;
    border-right: 2px solid var(--paper, #F5EDD8);
    box-sizing: border-box;
    transition: background .2s;
  }

  .section-block.active {
    background: rgba(173,107,53,.15);
    border-right-color: var(--paper, #F5EDD8);
  }

  .section-block.done {
    /* covered by progress fill */
  }

  /* Step dots */
  .step-dot {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(28, 22, 14, .25);
    border: 2px solid var(--paper, #F5EDD8);
    transition: background .2s, transform .2s;
  }

  .step-dot.step-done {
    background: var(--copper, #AD6B35);
  }

  .step-dot.step-current {
    background: var(--forest, #2D4228);
    width: 12px;
    height: 12px;
    border: 2px solid var(--paper, #F5EDD8);
    box-shadow: 0 0 0 2px var(--forest, #2D4228);
  }

  .step-dot.step-checked {
    background: var(--fern, #5B7A53);
  }

  /* Section labels */
  .section-labels {
    position: relative;
    height: 18px;
    margin-bottom: 8px;
  }

  .section-label {
    position: absolute;
    top: 0;
    font-family: 'Lora', serif;
    font-size: .68rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--muted, #7A6D5C);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 4px;
    box-sizing: border-box;
    transition: color .2s;
  }

  .section-label.active {
    color: var(--forest, #2D4228);
    font-weight: 600;
  }

  .section-label.done {
    color: var(--copper, #AD6B35);
  }

  /* Step labels (current section only) */
  .step-labels {
    display: flex;
    flex-wrap: wrap;
    gap: .35rem .75rem;
    padding: .25rem 0;
  }

  .step-label {
    font-family: 'Lora', serif;
    font-size: .78rem;
    color: var(--muted, #7A6D5C);
    display: flex;
    align-items: center;
    gap: .3rem;
  }

  .step-label.step-label-current {
    color: var(--forest, #2D4228);
    font-weight: 600;
  }

  .step-label.step-label-done {
    color: var(--copper, #AD6B35);
    text-decoration: line-through;
    opacity: .7;
  }

  .step-label.step-label-checked {
    color: var(--fern, #5B7A53);
  }

  .check-mark {
    font-size: .7rem;
    color: var(--fern, #5B7A53);
  }

  .step-dur {
    font-size: .7rem;
    color: var(--muted, #7A6D5C);
    opacity: .7;
  }
</style>
