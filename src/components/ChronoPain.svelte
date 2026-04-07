<script lang="ts">
  import { presets, type ChronoSection } from '../data/chronoPresets.ts';
  import ChronoTimeline from './ChronoTimeline.svelte';
  import QRCode from 'qrcode';
  import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

  // ── Types ──────────────────────────────────────────────────────────────────
  type Phase = 'config' | 'active' | 'done';

  interface PersistedState {
    version: 1;
    sections: ChronoSection[];
    currentSectionIdx: number;
    currentStepIdx: number;
    secondsLeft: number;
    checkedStepIds: string[];
    soundEnabled: boolean;
    waitingForSectionValidation: boolean;
    savedAt: number;
  }

  // ── Helpers (hoisted) ─────────────────────────────────────────────────────
  function getInitialPresetId(): string {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('preset') ?? presets[0]?.id ?? '';
    }
    return presets[0]?.id ?? '';
  }

  function sectionsFromPresetId(id: string): ChronoSection[] {
    const preset = presets.find(p => p.id === id);
    return structuredClone(preset?.sections ?? presets[0]?.sections ?? []);
  }

  // ── Partage / QR Code ─────────────────────────────────────────────────────
  interface SharePayload {
    label: string;
    sections: Array<{ id: string; name: string; steps: Array<{ name: string; dureeMin: number }> }>;
  }

  function buildPayload(label: string, secs: ChronoSection[]): SharePayload {
    return {
      label,
      sections: secs.map(s => ({
        id: s.id,
        name: s.name,
        steps: s.steps.map(st => ({ name: st.name, dureeMin: st.dureeMin })),
      })),
    };
  }

  // v1 — liens texte, rétrocompat
  function encodeProtocol(label: string, secs: ChronoSection[]): string {
    const json = JSON.stringify(buildPayload(label, secs));
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // v2 — QR codes uniquement (deflate + base64url, préfixe "z.")
  function encodeQRPayload(label: string, secs: ChronoSection[]): string {
    const json = JSON.stringify(buildPayload(label, secs));
    const compressed = deflateSync(strToU8(json));
    const b64 = btoa(String.fromCharCode(...compressed));
    const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return 'z.' + b64url;
  }

  function decodeProtocol(encoded: string): ChronoSection[] | null {
    try {
      let payload: SharePayload;
      if (encoded.startsWith('z.')) {
        // v2 compressé
        const b64 = encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/');
        const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const json = strFromU8(inflateSync(binary));
        payload = JSON.parse(json) as SharePayload;
      } else {
        // v1 rétrocompat
        const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(escape(atob(b64)));
        payload = JSON.parse(json) as SharePayload;
      }
      return payload.sections.map(s => ({
        id: s.id,
        name: s.name,
        steps: s.steps.map(st => ({ id: crypto.randomUUID(), name: st.name, dureeMin: st.dureeMin })),
      }));
    } catch { return null; }
  }

  function getProtocolFromUrl(): ChronoSection[] | null {
    if (typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.search).get('p');
    return p ? decodeProtocol(p) : null;
  }

  function getLabel(): string {
    return presets.find(p => p.id === selectedPresetId)?.label ?? 'Process personnalisé';
  }

  function buildShareUrl(qr = false): string {
    const encoded = qr ? encodeQRPayload(getLabel(), sections) : encodeProtocol(getLabel(), sections);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://benoitdw.github.io';
    return `${origin}/laCuisineDeBenoit/pain/chrono/?p=${encoded}`;
  }

  function formatTime(s: number): string {
    const abs = Math.max(0, Math.round(s));
    return `${Math.floor(abs / 60)}:${(abs % 60).toString().padStart(2, '0')}`;
  }

  function formatHour(ms: number): string {
    return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function slugify(str: string): string {
    return str.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let phase                       = $state<Phase>('config');
  let selectedPresetId            = $state(getInitialPresetId());
  let sections                    = $state<ChronoSection[]>(getProtocolFromUrl() ?? sectionsFromPresetId(getInitialPresetId()));
  let soundEnabled                = $state(true);
  let currentSectionIdx           = $state(0);
  let currentStepIdx              = $state(0);
  let secondsLeft                 = $state(0);
  let paused                      = $state(false);
  let waitingForSectionValidation = $state(false);
  let checkedStepIds              = $state(new Set<string>());
  let showResumePrompt            = $state(false);
  let resumeCandidate             = $state<PersistedState | null>(null);
  let showProposeForm             = $state(false);
  let proposePresetName           = $state('');
  let showQRModal                 = $state(false);
  let qrDataUrl                   = $state('');
  let shareUrl                    = $state('');
  let copyDone                    = $state(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentSection = $derived(sections[currentSectionIdx]);
  const currentStep    = $derived(currentSection?.steps[currentStepIdx]);

  const totalSeconds = $derived.by(() =>
    sections.reduce((sum, s) => sum + s.steps.reduce((a, st) => a + st.dureeMin * 60, 0), 0)
  );

  const elapsedSeconds = $derived.by(() => {
    let elapsed = 0;
    for (let si = 0; si < currentSectionIdx; si++) {
      elapsed += sections[si].steps.reduce((a, st) => a + st.dureeMin * 60, 0);
    }
    const sec = sections[currentSectionIdx];
    if (sec) {
      for (let ti = 0; ti < currentStepIdx; ti++) elapsed += sec.steps[ti].dureeMin * 60;
      const st = sec.steps[currentStepIdx];
      if (st) elapsed += st.dureeMin * 60 - secondsLeft;
    }
    return elapsed;
  });

  const remainingTotalSeconds = $derived(totalSeconds - elapsedSeconds);

  const secondsToSectionEnd = $derived.by(() => {
    let total = secondsLeft;
    const sec = sections[currentSectionIdx];
    if (!sec) return 0;
    for (let ti = currentStepIdx + 1; ti < sec.steps.length; ti++) {
      total += sec.steps[ti].dureeMin * 60;
    }
    return total;
  });

  const projectedEndMs = $derived(Date.now() + remainingTotalSeconds * 1000);

  const totalLabel = $derived.by(() => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    if (h > 0) return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
    return `${m} min`;
  });

  // ── Config actions ────────────────────────────────────────────────────────
  // Note: direct mutations work because $state is deeply reactive in Svelte 5.
  // structuredClone on a $state proxy causes silent failures.

  function onPresetChange(e: Event) {
    // Read value from event target to avoid bind:value + onchange ordering issues
    const id = (e.target as HTMLSelectElement).value;
    selectedPresetId = id;
    sections = sectionsFromPresetId(id);
  }

  function addSection(atIndex: number = sections.length) {
    sections.splice(atIndex, 0, {
      id: crypto.randomUUID(),
      name: 'Nouvelle section',
      steps: [{ id: crypto.randomUUID(), name: 'Étape', dureeMin: 30 }],
    });
  }

  function removeSection(si: number) {
    sections.splice(si, 1);
  }

  function addStep(si: number, atIndex: number = sections[si].steps.length) {
    sections[si].steps.splice(atIndex, 0, { id: crypto.randomUUID(), name: 'Étape', dureeMin: 15 });
  }

  function removeStep(si: number, ti: number) {
    sections[si].steps.splice(ti, 1);
  }

  function updateSectionName(si: number, name: string) {
    sections[si].name = name;
  }

  function updateStepName(si: number, ti: number, name: string) {
    sections[si].steps[ti].name = name;
  }

  function updateStepDuree(si: number, ti: number, val: number) {
    sections[si].steps[ti].dureeMin = Math.max(1, val);
  }

  function startTimer() {
    if (sections.length === 0 || !sections.some(s => s.steps.length > 0)) return;
    // Find first section that has steps
    const firstSi = sections.findIndex(s => s.steps.length > 0);
    currentSectionIdx = firstSi;
    currentStepIdx = 0;
    secondsLeft = sections[firstSi].steps[0].dureeMin * 60;
    paused = false;
    waitingForSectionValidation = false;
    checkedStepIds = new Set();
    phase = 'active';
    // Init AudioContext on user gesture
    getAudio();
  }

  // ── Timer actions ─────────────────────────────────────────────────────────
  function advanceStep() {
    playBell();
    const section = sections[currentSectionIdx];
    const nextTi = currentStepIdx + 1;

    if (nextTi < section.steps.length) {
      currentStepIdx = nextTi;
      secondsLeft = section.steps[nextTi].dureeMin * 60;
    } else {
      const nextSi = currentSectionIdx + 1;
      if (nextSi < sections.length) {
        secondsLeft = 0;
        waitingForSectionValidation = true;
        playAlarm();
      } else {
        phase = 'done';
        clearLocalStorage();
      }
    }
  }

  function validateSection() {
    const nextSi = currentSectionIdx + 1;
    currentSectionIdx = nextSi;
    currentStepIdx = 0;
    secondsLeft = sections[nextSi].steps[0].dureeMin * 60;
    waitingForSectionValidation = false;
  }

  function toggleCheck(stepId: string) {
    const next = new Set(checkedStepIds);
    if (next.has(stepId)) next.delete(stepId); else next.add(stepId);
    checkedStepIds = next;
  }

  function togglePause() { paused = !paused; }

  function resetTimer() {
    clearLocalStorage();
    phase = 'config';
    currentSectionIdx = 0;
    currentStepIdx = 0;
    secondsLeft = 0;
    paused = false;
    waitingForSectionValidation = false;
    checkedStepIds = new Set();
  }

  // ── Audio (Web Audio API) ─────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null;

  function getAudio(): AudioContext | null {
    if (!soundEnabled) return null;
    if (!audioCtx) {
      try { audioCtx = new AudioContext(); } catch { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playBell() {
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.2);
  }

  function playAlarm() {
    const ctx = getAudio();
    if (!ctx) return;
    [0, 0.4, 0.8, 1.2].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(i % 2 === 0 ? 660 : 550, ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.35);
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.35);
    });
  }

  // ── localStorage ──────────────────────────────────────────────────────────
  const STORAGE_KEY = 'levainier_state';

  function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      sections,
      currentSectionIdx,
      currentStepIdx,
      secondsLeft,
      checkedStepIds: [...checkedStepIds],
      soundEnabled,
      waitingForSectionValidation,
      savedAt: Date.now(),
    } satisfies PersistedState));
  }

  function clearLocalStorage() { localStorage.removeItem(STORAGE_KEY); }

  // Avance le timer d'une durée écoulée, sans franchir les sections (validation manuelle)
  function applyElapsedTime(s: PersistedState): void {
    if (s.waitingForSectionValidation) return;
    let elapsed = Math.max(0, Math.floor((Date.now() - s.savedAt) / 1000));
    if (elapsed <= 0) return;

    const section = s.sections[s.currentSectionIdx];
    if (!section) return;

    let sti = s.currentStepIdx;
    let sLeft = s.secondsLeft;

    while (elapsed > 0) {
      if (elapsed < sLeft) {
        sLeft -= elapsed;
        elapsed = 0;
      } else {
        elapsed -= sLeft;
        const next = sti + 1;
        if (next >= section.steps.length) {
          // Fin de section — on s'arrête ici
          sLeft = 0;
          s.waitingForSectionValidation = true;
          elapsed = 0;
        } else {
          sti = next;
          sLeft = section.steps[sti].dureeMin * 60;
        }
      }
    }

    s.currentStepIdx = sti;
    s.secondsLeft = sLeft;
  }

  function acceptResume() {
    if (!resumeCandidate) return;
    applyElapsedTime(resumeCandidate);
    const s = resumeCandidate;
    sections = s.sections;
    currentSectionIdx = s.currentSectionIdx;
    currentStepIdx = s.currentStepIdx;
    secondsLeft = s.secondsLeft;
    checkedStepIds = new Set(s.checkedStepIds);
    soundEnabled = s.soundEnabled;
    waitingForSectionValidation = s.waitingForSectionValidation;
    phase = 'active';
    showResumePrompt = false;
    resumeCandidate = null;
  }

  function rejectResume() {
    clearLocalStorage();
    showResumePrompt = false;
    resumeCandidate = null;
  }

  // ── Propose preset ────────────────────────────────────────────────────────
  function serializePresetToJson(): string {
    const id = slugify(proposePresetName) || 'nouveau-preset';
    return JSON.stringify({
      id,
      label: proposePresetName,
      sections: sections.map(sec => ({
        id: slugify(sec.name) || sec.id,
        name: sec.name,
        steps: sec.steps.map(st => ({ name: st.name, dureeMin: st.dureeMin })),
      })),
    }, null, 2);
  }

  function proposePreset() {
    const id = slugify(proposePresetName) || 'nouveau-preset';
    const json = serializePresetToJson();
    const base = 'https://github.com/Benoitdw/laCuisineDeBenoit/new/master';
    const params = new URLSearchParams({
      filename: `src/data/presets/${id}.json`,
      value: json,
      message: `feat: nouveau preset "${proposePresetName}"`,
    });
    window.open(`${base}?${params}`, '_blank');
    showProposeForm = false;
    proposePresetName = '';
  }

  // ── QR Code ───────────────────────────────────────────────────────────────
  async function openQRModal() {
    const qrUrl = buildShareUrl(true);   // v2 compressé pour le QR
    shareUrl = buildShareUrl(false);     // v1 pour le lien texte à copier
    qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#1C160E', light: '#F5EDD8' },
    });
    showQRModal = true;
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(shareUrl);
    copyDone = true;
    setTimeout(() => { copyDone = false; }, 2000);
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  // Check localStorage on mount
  $effect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as PersistedState;
      if (saved.version !== 1) { clearLocalStorage(); return; }
      resumeCandidate = saved;
      showResumePrompt = true;
    } catch { clearLocalStorage(); }
  });

  // Interval timer
  $effect(() => {
    if (phase !== 'active' || paused || waitingForSectionValidation) return;

    const interval = setInterval(() => {
      if (waitingForSectionValidation || phase !== 'active') return;
      if (secondsLeft > 0) {
        secondsLeft--;
      } else {
        advanceStep();
      }
      saveToLocalStorage();
    }, 1000);

    return () => clearInterval(interval);
  });
</script>

<!-- ── QR Code modal ─────────────────────────────────────────────────────── -->
{#if showQRModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="qr-overlay" onclick={() => showQRModal = false}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="qr-modal" onclick={(e) => e.stopPropagation()}>
      <button class="close" onclick={() => showQRModal = false} aria-label="Fermer">×</button>
      <h3 class="qr-title">Partager ce process</h3>
      <p class="qr-sub">Scannez ce QR code avec l'app Levainier, ou copiez le lien.</p>
      {#if qrDataUrl}
        <img class="qr-img" src={qrDataUrl} alt="QR code du process" />
      {/if}
      <div class="qr-url-row">
        <span class="qr-url">{shareUrl}</span>
        <button class="btn-copy" onclick={copyUrl}>
          {copyDone ? '✓ Copié' : 'Copier'}
        </button>
      </div>
      <p class="qr-hint">L'app Android décode ce lien et charge le process automatiquement.</p>
    </div>
  </div>
{/if}

<!-- ── Resume prompt ──────────────────────────────────────────────────────── -->
{#if showResumePrompt}
  <div class="resume-overlay">
    <div class="resume-card">
      <p class="resume-title">Reprise en cours ?</p>
      {#if resumeCandidate}
        {@const elapsedMin = Math.floor((Date.now() - resumeCandidate.savedAt) / 60000)}
        <p class="resume-sub">
          {#if elapsedMin < 1}
            Session trouvée. Le timer reprend là où il en était.
          {:else}
            Absent{elapsedMin >= 60
              ? ` ${Math.floor(elapsedMin / 60)}h${(elapsedMin % 60).toString().padStart(2, '0')}`
              : ` ${elapsedMin} min`} — le timer sera avancé en conséquence (arrêt en fin de section).
          {/if}
        </p>
      {/if}
      <div class="resume-actions">
        <button class="btn-primary" onclick={acceptResume}>Reprendre</button>
        <button class="btn-ghost" onclick={rejectResume}>Recommencer</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Phase config ───────────────────────────────────────────────────────── -->
{#if phase === 'config'}
  <div class="config-phase">

    <!-- Sélecteur preset -->
    <div class="preset-row">
      <label class="field-label" for="preset-select">process</label>
      <select id="preset-select" class="select" value={selectedPresetId} onchange={onPresetChange}>
        {#each presets as p}
          <option value={p.id}>{p.label}</option>
        {/each}
      </select>
    </div>

    <!-- Timeline preview -->
    {#if totalSeconds > 0}
      <div class="preview-block">
        <ChronoTimeline
          {sections}
          currentSectionIdx={-1}
          currentStepIdx={-1}
          checkedStepIds={new Set()}
          elapsedSeconds={0}
          {totalSeconds}
        />
        <p class="total-dur">Durée totale estimée : <strong>{totalLabel}</strong></p>
      </div>
    {/if}

    <!-- Sections éditables -->
    <div class="sections-editor">
      <button class="btn-insert-section" onclick={() => addSection(0)} title="Insérer une section ici">
        <span class="insert-line"></span><span class="insert-plus">+ section</span><span class="insert-line"></span>
      </button>

      {#each sections as section, si (section.id)}
        <div class="section-card">
          <div class="section-header">
            <input
              class="section-name-input"
              type="text"
              value={section.name}
              oninput={(e) => updateSectionName(si, (e.target as HTMLInputElement).value)}
              placeholder="Nom de la section"
            />
            <button class="btn-remove" onclick={() => removeSection(si)} aria-label="Supprimer la section" title="Supprimer">×</button>
          </div>

          <div class="steps-list">
            <button class="btn-insert-step" onclick={() => addStep(si, 0)} title="Insérer une étape ici">
              <span class="insert-line"></span><span class="insert-plus">+</span><span class="insert-line"></span>
            </button>
            {#each section.steps as step, ti (step.id)}
              <div class="step-row">
                <input
                  class="step-name-input"
                  type="text"
                  value={step.name}
                  oninput={(e) => updateStepName(si, ti, (e.target as HTMLInputElement).value)}
                  placeholder="Étape"
                />
                <input
                  class="step-dur-input"
                  type="number"
                  min="1"
                  max="999"
                  value={step.dureeMin}
                  oninput={(e) => updateStepDuree(si, ti, parseInt((e.target as HTMLInputElement).value) || 1)}
                />
                <span class="dur-unit">min</span>
                <button class="btn-remove-step" onclick={() => removeStep(si, ti)} aria-label="Supprimer l'étape">×</button>
              </div>
              <button class="btn-insert-step" onclick={() => addStep(si, ti + 1)} title="Insérer une étape ici">
                <span class="insert-line"></span><span class="insert-plus">+</span><span class="insert-line"></span>
              </button>
            {/each}
          </div>
        </div>

        <button class="btn-insert-section" onclick={() => addSection(si + 1)} title="Insérer une section ici">
          <span class="insert-line"></span><span class="insert-plus">+ section</span><span class="insert-line"></span>
        </button>
      {/each}
    </div>

    <!-- Actions -->
    <div class="config-actions">
      <button
        class="btn-start"
        onclick={startTimer}
        disabled={sections.length === 0 || !sections.some(s => s.steps.length > 0)}
      >
        Démarrer
      </button>

      <div class="propose-wrap">
        <button class="btn-qr" onclick={openQRModal} title="Générer un QR Code pour partager ce process">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="1" y="1" width="5" height="5" rx=".5"/><rect x="2" y="2" width="3" height="3"/>
            <rect x="10" y="1" width="5" height="5" rx=".5"/><rect x="11" y="2" width="3" height="3"/>
            <rect x="1" y="10" width="5" height="5" rx=".5"/><rect x="2" y="11" width="3" height="3"/>
            <line x1="10" y1="10" x2="10" y2="10.01"/><line x1="13" y1="10" x2="13" y2="10.01"/>
            <line x1="10" y1="13" x2="10" y2="15"/><line x1="13" y1="12" x2="15" y2="12"/>
            <line x1="15" y1="15" x2="15" y2="15.01"/>
          </svg>
          QR Code
        </button>
        {#if showProposeForm}
          <div class="propose-form">
            <input
              class="propose-input"
              type="text"
              bind:value={proposePresetName}
              placeholder="Nom de mon preset"
              onkeydown={(e) => e.key === 'Enter' && proposePresetName && proposePreset()}
            />
            <button
              class="btn-propose-confirm"
              onclick={proposePreset}
              disabled={!proposePresetName}
            >
              Ouvrir GitHub →
            </button>
            <button class="btn-ghost-sm" onclick={() => { showProposeForm = false; proposePresetName = ''; }}>Annuler</button>
          </div>
        {:else}
          <button class="btn-propose" onclick={() => showProposeForm = true}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="5" cy="4" r="1.5"/>
              <circle cx="11" cy="4" r="1.5"/>
              <circle cx="5" cy="12" r="1.5"/>
              <line x1="5" y1="5.5" x2="5" y2="10.5"/>
              <path d="M11 5.5 Q11 9 7.5 10 L5 10.5"/>
            </svg>
            Proposer ce process
          </button>
        {/if}
      </div>
    </div>

  </div>
{/if}

<!-- ── Phase active ───────────────────────────────────────────────────────── -->
{#if phase === 'active'}
  <div class="active-phase">

    <!-- Timeline -->
    <div class="timeline-wrap">
      <ChronoTimeline
        {sections}
        {currentSectionIdx}
        {currentStepIdx}
        {checkedStepIds}
        {elapsedSeconds}
        {totalSeconds}
      />
    </div>

    <!-- Gate section -->
    {#if waitingForSectionValidation}
      <div class="section-gate">
        <p class="gate-done">
          <span class="gate-section-name">{currentSection?.name}</span> terminée
        </p>
        {#if currentSectionIdx + 1 < sections.length}
          <p class="gate-next">Prêt pour la prochaine section ?</p>
          <p class="gate-next-name">{sections[currentSectionIdx + 1]?.name}</p>
          <button class="btn-validate" onclick={validateSection}>
            Commencer →
          </button>
        {/if}
      </div>
    {:else}
      <!-- Countdown principal -->
      <div class="countdown-block">
        <div class="section-badge">{currentSection?.name ?? ''}</div>
        <div class="step-title">{currentStep?.name ?? ''}</div>
        <div class="countdown">{formatTime(secondsLeft)}</div>

        <!-- Clic sur l'étape pour la cocher / passer -->
        {#if currentStep}
          <div class="step-actions">
            <button
              class="step-check-btn"
              class:checked={checkedStepIds.has(currentStep.id)}
              onclick={() => currentStep && toggleCheck(currentStep.id)}
              title="Marquer cette étape comme faite sans changer le timer"
            >
              {checkedStepIds.has(currentStep.id) ? '✓ Faite' : 'Marquer comme faite'}
            </button>
            <button
              class="btn-skip-step"
              onclick={advanceStep}
              title="Passer immédiatement à l'étape suivante"
            >
              Passer →
            </button>
          </div>
        {/if}
      </div>

      <!-- Bandeau infos -->
      <div class="info-strip">
        <div class="info-item">
          <span class="info-label">Prochaine étape</span>
          <span class="info-val">{formatTime(secondsLeft)}</span>
        </div>
        <div class="info-sep"></div>
        <div class="info-item">
          <span class="info-label">Fin de section</span>
          <span class="info-val">{formatTime(secondsToSectionEnd)}</span>
        </div>
        <div class="info-sep"></div>
        <div class="info-item">
          <span class="info-label">Fin prévue</span>
          <span class="info-val">{formatHour(projectedEndMs)}</span>
        </div>
      </div>
    {/if}

    <!-- Contrôles -->
    <div class="controls">
      {#if !waitingForSectionValidation}
        <button class="btn-control" onclick={togglePause}>
          {paused ? '▶ Reprendre' : '⏸ Pause'}
        </button>
      {/if}
      <button
        class="btn-control btn-sound"
        class:sound-off={!soundEnabled}
        onclick={() => soundEnabled = !soundEnabled}
        title={soundEnabled ? 'Couper le son' : 'Activer le son'}
      >
        {soundEnabled ? '🔔' : '🔕'}
      </button>

      <div class="controls-right">
        <button class="btn-qr" onclick={openQRModal} title="Générer un QR Code pour partager ce process">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="1" y="1" width="5" height="5" rx=".5"/><rect x="2" y="2" width="3" height="3"/>
            <rect x="10" y="1" width="5" height="5" rx=".5"/><rect x="11" y="2" width="3" height="3"/>
            <rect x="1" y="10" width="5" height="5" rx=".5"/><rect x="2" y="11" width="3" height="3"/>
            <line x1="10" y1="10" x2="10" y2="10.01"/><line x1="13" y1="10" x2="13" y2="10.01"/>
            <line x1="10" y1="13" x2="10" y2="15"/><line x1="13" y1="12" x2="15" y2="12"/>
            <line x1="15" y1="15" x2="15" y2="15.01"/>
          </svg>
          QR Code
        </button>
        {#if showProposeForm}
          <div class="propose-form">
            <input
              class="propose-input"
              type="text"
              bind:value={proposePresetName}
              placeholder="Nom de mon preset"
              onkeydown={(e) => e.key === 'Enter' && proposePresetName && proposePreset()}
            />
            <button class="btn-propose-confirm" onclick={proposePreset} disabled={!proposePresetName}>
              Ouvrir GitHub →
            </button>
            <button class="btn-ghost-sm" onclick={() => { showProposeForm = false; proposePresetName = ''; }}>Annuler</button>
          </div>
        {:else}
          <button class="btn-propose" onclick={() => showProposeForm = true}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="5" cy="4" r="1.5"/>
              <circle cx="11" cy="4" r="1.5"/>
              <circle cx="5" cy="12" r="1.5"/>
              <line x1="5" y1="5.5" x2="5" y2="10.5"/>
              <path d="M11 5.5 Q11 9 7.5 10 L5 10.5"/>
            </svg>
            Proposer ce process
          </button>
        {/if}
        <button class="btn-control btn-reset" onclick={resetTimer}>↺ Reset</button>
      </div>
    </div>

  </div>
{/if}

<!-- ── Phase done ─────────────────────────────────────────────────────────── -->
{#if phase === 'done'}
  <div class="done-phase">
    <div class="done-ornament" aria-hidden="true">
      <svg width="80" height="80" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width=".5">
        <line x1="2" y1="13" x2="14" y2="13"/>
        <path d="M2 13 Q2 4 8 3 Q14 4 14 13"/>
        <path d="M5 8 Q8 6.5 11 8" stroke-width=".4"/>
      </svg>
    </div>
    <p class="done-title">Bonne fournée !</p>
    <p class="done-sub">Toutes les étapes sont terminées.</p>
    <button class="btn-primary" onclick={resetTimer}>Recommencer</button>
  </div>
{/if}

<style>
  /* ── Shared ────────────────────────────────────────────────────────────── */
  .btn-primary {
    background: var(--forest, #2D4228);
    color: var(--paper, #F5EDD8);
    border: none;
    border-radius: 3px;
    padding: .65rem 1.5rem;
    font-family: 'Playfair Display', serif;
    font-size: .95rem;
    cursor: pointer;
    transition: background .15s;
  }
  .btn-primary:hover { background: var(--fern, #5B7A53); }
  .btn-primary:disabled { opacity: .4; cursor: default; }

  .btn-ghost {
    background: none;
    border: 1px solid var(--rule, rgba(28,22,14,.13));
    border-radius: 3px;
    padding: .6rem 1.2rem;
    font-family: 'Lora', serif;
    font-size: .88rem;
    color: var(--muted, #7A6D5C);
    cursor: pointer;
    transition: border-color .15s, color .15s;
  }
  .btn-ghost:hover { border-color: var(--copper, #AD6B35); color: var(--ink, #1C160E); }

  .btn-ghost-sm {
    background: none;
    border: none;
    padding: .4rem .7rem;
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--muted, #7A6D5C);
    cursor: pointer;
  }
  .btn-ghost-sm:hover { color: var(--ink, #1C160E); }

  /* ── Resume ────────────────────────────────────────────────────────────── */
  .resume-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 1rem;
  }

  .resume-card {
    background: var(--paper, #F5EDD8);
    border-radius: 4px;
    max-width: 400px;
    width: 100%;
    padding: 2rem;
    box-shadow: 0 8px 40px rgba(0,0,0,.3);
  }

  .resume-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--forest, #2D4228);
    margin-bottom: .5rem;
  }

  .resume-sub {
    font-family: 'Lora', serif;
    font-size: .88rem;
    color: var(--muted, #7A6D5C);
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .resume-actions {
    display: flex;
    gap: .75rem;
    flex-wrap: wrap;
  }

  /* ── Config phase ──────────────────────────────────────────────────────── */
  .config-phase {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .preset-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .field-label {
    font-family: 'Lora', serif;
    font-size: .78rem;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--muted, #7A6D5C);
    white-space: nowrap;
  }

  .select {
    font-family: 'Lora', serif;
    font-size: .88rem;
    color: var(--ink, #1C160E);
    background: var(--card, #FBF7EE);
    border: 1px solid var(--rule, rgba(28,22,14,.13));
    border-radius: 3px;
    padding: .45rem .75rem;
    cursor: pointer;
    outline: none;
    transition: border-color .15s;
  }
  .select:focus { border-color: var(--copper, #AD6B35); }

  .preview-block {
    background: rgba(28,22,14,.03);
    border: 1px solid var(--rule, rgba(28,22,14,.13));
    border-radius: 3px;
    padding: 1rem 1rem .5rem;
  }

  .total-dur {
    font-family: 'Lora', serif;
    font-size: .8rem;
    color: var(--muted, #7A6D5C);
    margin-top: .75rem;
    text-align: right;
  }

  .sections-editor {
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }

  .section-card {
    border: 1px solid var(--rule, rgba(28,22,14,.13));
    border-radius: 3px;
    padding: .9rem 1rem;
    background: var(--card, #FBF7EE);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: .5rem;
    margin-bottom: .7rem;
  }

  .section-name-input {
    flex: 1;
    font-family: 'Playfair Display', serif;
    font-size: .95rem;
    font-weight: 700;
    color: var(--forest, #2D4228);
    background: transparent;
    border: none;
    border-bottom: 1px solid transparent;
    padding: .2rem 0;
    outline: none;
    transition: border-color .15s;
  }
  .section-name-input:focus { border-bottom-color: var(--copper, #AD6B35); }

  .btn-remove {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: var(--muted, #7A6D5C);
    cursor: pointer;
    line-height: 1;
    padding: 0 .2rem;
    flex-shrink: 0;
  }
  .btn-remove:hover { color: #c0392b; }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: .4rem;
    margin-bottom: .6rem;
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: .5rem;
  }

  .step-name-input {
    flex: 1;
    font-family: 'Lora', serif;
    font-size: .85rem;
    color: var(--ink, #1C160E);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 2px;
    padding: .3rem .5rem;
    outline: none;
    transition: border-color .15s, background .15s;
  }
  .step-name-input:focus { border-color: var(--rule, rgba(28,22,14,.13)); background: var(--paper, #F5EDD8); }

  .step-dur-input {
    width: 56px;
    font-family: 'Lora', serif;
    font-size: .85rem;
    text-align: right;
    color: var(--ink, #1C160E);
    background: transparent;
    border: 1px solid var(--rule, rgba(28,22,14,.13));
    border-radius: 2px;
    padding: .3rem .4rem;
    outline: none;
    transition: border-color .15s;
  }
  .step-dur-input:focus { border-color: var(--copper, #AD6B35); }
  .step-dur-input::-webkit-inner-spin-button { opacity: 0.4; }

  .dur-unit {
    font-family: 'Lora', serif;
    font-size: .78rem;
    color: var(--muted, #7A6D5C);
    flex-shrink: 0;
  }

  .btn-remove-step {
    background: none;
    border: none;
    font-size: 1rem;
    color: var(--muted, #7A6D5C);
    cursor: pointer;
    line-height: 1;
    padding: 0 .15rem;
    flex-shrink: 0;
    opacity: .5;
  }
  .btn-remove-step:hover { opacity: 1; color: #c0392b; }

  /* Insert buttons (step + section) */
  .btn-insert-step,
  .btn-insert-section {
    display: flex;
    align-items: center;
    gap: .4rem;
    width: 100%;
    background: none;
    border: none;
    padding: .15rem 0;
    cursor: pointer;
    opacity: .25;
    transition: opacity .15s;
  }
  .btn-insert-step:hover,
  .btn-insert-section:hover { opacity: 1; }

  .btn-insert-section { padding: .3rem 0; }

  .insert-line {
    flex: 1;
    height: 1px;
    background: var(--copper, #AD6B35);
  }

  .insert-plus {
    font-family: 'Lora', serif;
    font-size: .72rem;
    color: var(--copper, #AD6B35);
    white-space: nowrap;
    letter-spacing: .05em;
  }

  .btn-insert-step .insert-plus { font-size: .78rem; font-weight: 600; }

  .config-actions {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    flex-wrap: wrap;
    padding-top: .5rem;
    border-top: 1px solid var(--rule, rgba(28,22,14,.1));
  }

  .btn-start {
    background: var(--forest, #2D4228);
    color: var(--paper, #F5EDD8);
    border: none;
    border-radius: 3px;
    padding: .75rem 2rem;
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    cursor: pointer;
    transition: background .15s;
  }
  .btn-start:hover:not(:disabled) { background: var(--fern, #5B7A53); }
  .btn-start:disabled { opacity: .4; cursor: default; }

  .propose-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: .75rem;
  }

  .btn-propose {
    display: flex;
    align-items: center;
    gap: .45rem;
    background: none;
    border: 1px solid var(--rule, rgba(28,22,14,.15));
    border-radius: 3px;
    font-family: 'Lora', serif;
    font-size: .85rem;
    color: var(--muted, #7A6D5C);
    padding: .5rem .9rem;
    cursor: pointer;
    transition: all .15s;
  }
  .btn-propose:hover { border-color: var(--forest, #2D4228); color: var(--forest, #2D4228); }

  .propose-form {
    display: flex;
    align-items: center;
    gap: .5rem;
    flex-wrap: wrap;
  }

  .propose-input {
    font-family: 'Lora', serif;
    font-size: .85rem;
    color: var(--ink, #1C160E);
    background: var(--card, #FBF7EE);
    border: 1px solid var(--rule, rgba(28,22,14,.2));
    border-radius: 3px;
    padding: .4rem .7rem;
    outline: none;
    width: 180px;
    transition: border-color .15s;
  }
  .propose-input:focus { border-color: var(--copper, #AD6B35); }

  .btn-propose-confirm {
    background: none;
    border: 1px solid var(--copper, #AD6B35);
    border-radius: 3px;
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--copper, #AD6B35);
    padding: .4rem .85rem;
    cursor: pointer;
    transition: background .15s, color .15s;
  }
  .btn-propose-confirm:hover:not(:disabled) { background: var(--copper, #AD6B35); color: white; }
  .btn-propose-confirm:disabled { opacity: .4; cursor: default; }

  /* ── Active phase ──────────────────────────────────────────────────────── */
  .active-phase {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .timeline-wrap {
    background: rgba(28,22,14,.03);
    border: 1px solid var(--rule, rgba(28,22,14,.13));
    border-radius: 3px;
    padding: 1rem 1rem .75rem;
  }

  /* Section gate */
  .section-gate {
    background: var(--forest, #2D4228);
    border-radius: 4px;
    padding: 2rem;
    text-align: center;
    color: var(--paper, #F5EDD8);
  }

  .gate-done {
    font-family: 'Lora', serif;
    font-size: .85rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    opacity: .7;
    margin-bottom: .5rem;
  }

  .gate-section-name {
    font-weight: 600;
  }

  .gate-next {
    font-family: 'Lora', serif;
    font-size: .9rem;
    opacity: .7;
    margin-bottom: .4rem;
  }

  .gate-next-name {
    font-family: 'Playfair Display', serif;
    font-size: 1.4rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
  }

  .btn-validate {
    background: var(--copper, #AD6B35);
    color: white;
    border: none;
    border-radius: 3px;
    padding: .75rem 2rem;
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    cursor: pointer;
    transition: background .15s;
  }
  .btn-validate:hover { background: #c47c3e; }

  /* Countdown block */
  .countdown-block {
    text-align: center;
    padding: 1.5rem 1rem;
  }

  .section-badge {
    display: inline-block;
    font-family: 'Lora', serif;
    font-size: .72rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--copper, #AD6B35);
    border: 1px solid var(--copper-lt, #E8D0BB);
    border-radius: 2px;
    padding: .2rem .65rem;
    margin-bottom: .75rem;
  }

  .step-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--forest, #2D4228);
    margin-bottom: .75rem;
  }

  .countdown {
    font-family: 'Playfair Display', serif;
    font-size: clamp(3rem, 12vw, 5rem);
    font-weight: 700;
    color: var(--ink, #1C160E);
    font-variant-numeric: tabular-nums;
    letter-spacing: -.02em;
    line-height: 1;
    margin-bottom: 1rem;
  }

  .step-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .75rem;
    flex-wrap: wrap;
  }

  .btn-skip-step {
    display: inline-block;
    background: none;
    border: 1px solid var(--copper-lt, #E8D0BB);
    border-radius: 3px;
    font-family: 'Lora', serif;
    font-size: .8rem;
    color: var(--copper, #AD6B35);
    padding: .35rem .85rem;
    cursor: pointer;
    transition: all .15s;
  }
  .btn-skip-step:hover { background: var(--copper, #AD6B35); border-color: var(--copper, #AD6B35); color: white; }

  .step-check-btn {
    display: inline-block;
    background: none;
    border: 1px solid var(--rule, rgba(28,22,14,.15));
    border-radius: 3px;
    font-family: 'Lora', serif;
    font-size: .8rem;
    color: var(--muted, #7A6D5C);
    padding: .35rem .85rem;
    cursor: pointer;
    transition: all .15s;
  }
  .step-check-btn:hover { border-color: var(--fern, #5B7A53); color: var(--fern, #5B7A53); }
  .step-check-btn.checked { background: var(--fern-lt, #C8D9C3); border-color: var(--fern, #5B7A53); color: var(--fern, #5B7A53); }

  /* Info strip */
  .info-strip {
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 0;
    background: rgba(28,22,14,.04);
    border: 1px solid var(--rule, rgba(28,22,14,.1));
    border-radius: 3px;
    overflow: hidden;
  }

  .info-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: .75rem .5rem;
    gap: .25rem;
  }

  .info-sep {
    width: 1px;
    background: var(--rule, rgba(28,22,14,.1));
    align-self: stretch;
  }

  .info-label {
    font-family: 'Lora', serif;
    font-size: .68rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--muted, #7A6D5C);
  }

  .info-val {
    font-family: 'Playfair Display', serif;
    font-size: 1rem;
    font-weight: 700;
    color: var(--forest, #2D4228);
    font-variant-numeric: tabular-nums;
  }

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    gap: .75rem;
    flex-wrap: wrap;
    padding-top: .5rem;
    border-top: 1px solid var(--rule, rgba(28,22,14,.1));
  }

  .btn-control {
    background: none;
    border: 1px solid var(--rule, rgba(28,22,14,.15));
    border-radius: 3px;
    font-family: 'Lora', serif;
    font-size: .85rem;
    color: var(--ink, #1C160E);
    padding: .5rem 1rem;
    cursor: pointer;
    transition: all .15s;
  }
  .btn-control:hover { border-color: var(--forest, #2D4228); }

  .btn-sound.sound-off {
    opacity: .5;
    text-decoration: line-through;
  }

  .controls-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: .75rem;
    flex-wrap: wrap;
  }

  .btn-reset {
    color: var(--muted, #7A6D5C);
    font-size: .8rem;
  }
  .btn-reset:hover { color: #c0392b; border-color: #c0392b; }

  /* ── Done phase ────────────────────────────────────────────────────────── */
  .done-phase {
    text-align: center;
    padding: 3rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .done-ornament {
    color: var(--copper, #AD6B35);
    opacity: .4;
    margin-bottom: .5rem;
  }

  .done-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--forest, #2D4228);
  }

  .done-sub {
    font-family: 'Lora', serif;
    font-size: .9rem;
    color: var(--muted, #7A6D5C);
    font-style: italic;
    margin-bottom: .5rem;
  }

  /* ── QR Code ───────────────────────────────────────────────────────────── */
  .btn-qr {
    display: flex;
    align-items: center;
    gap: .45rem;
    background: none;
    border: 1px solid var(--rule, rgba(28,22,14,.15));
    border-radius: 3px;
    font-family: 'Lora', serif;
    font-size: .85rem;
    color: var(--muted, #7A6D5C);
    padding: .5rem .9rem;
    cursor: pointer;
    transition: all .15s;
  }
  .btn-qr:hover { border-color: var(--forest, #2D4228); color: var(--forest, #2D4228); }

  .qr-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: 1rem;
  }

  .qr-modal {
    background: var(--paper, #F5EDD8);
    border-radius: 4px;
    max-width: 380px;
    width: 100%;
    padding: 2rem;
    position: relative;
    box-shadow: 0 8px 40px rgba(0,0,0,.3);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .75rem;
  }

  .qr-title {
    font-family: 'Playfair Display', serif;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--forest, #2D4228);
    text-align: center;
  }

  .qr-sub {
    font-family: 'Lora', serif;
    font-size: .82rem;
    color: var(--muted, #7A6D5C);
    text-align: center;
    line-height: 1.5;
  }

  .qr-img {
    width: 200px;
    height: 200px;
    border-radius: 4px;
    border: 1px solid var(--rule, rgba(28,22,14,.1));
  }

  .qr-url-row {
    display: flex;
    align-items: center;
    gap: .5rem;
    width: 100%;
    background: rgba(28,22,14,.05);
    border: 1px solid var(--rule, rgba(28,22,14,.1));
    border-radius: 3px;
    padding: .4rem .6rem;
  }

  .qr-url {
    font-family: 'Lora', serif;
    font-size: .7rem;
    color: var(--muted, #7A6D5C);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-copy {
    background: var(--copper, #AD6B35);
    color: white;
    border: none;
    border-radius: 2px;
    font-family: 'Lora', serif;
    font-size: .75rem;
    padding: .25rem .6rem;
    cursor: pointer;
    white-space: nowrap;
    transition: background .15s;
    flex-shrink: 0;
  }
  .btn-copy:hover { background: #c47c3e; }

  .qr-hint {
    font-family: 'Lora', serif;
    font-size: .75rem;
    color: var(--muted, #7A6D5C);
    font-style: italic;
    text-align: center;
    line-height: 1.5;
  }
</style>
