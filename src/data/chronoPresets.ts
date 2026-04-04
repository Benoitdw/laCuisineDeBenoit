export interface ChronoStep {
  id: string;
  name: string;
  dureeMin: number;
}

export interface ChronoSection {
  id: string;
  name: string;
  steps: ChronoStep[];
}

export interface ChronoPreset {
  id: string;
  label: string;
  sections: ChronoSection[];
}

interface RawStep    { name: string; dureeMin: number; }
interface RawSection { id: string; name: string; steps: RawStep[]; }
interface RawPreset  { id: string; label: string; sections: RawSection[]; }

function injectIds(raw: RawPreset): ChronoPreset {
  return {
    ...raw,
    sections: raw.sections.map(section => ({
      ...section,
      steps: section.steps.map(step => ({
        id: crypto.randomUUID(),
        ...step,
      })),
    })),
  };
}

const modules = import.meta.glob<RawPreset>('./presets/*.json', { eager: true, import: 'default' });
export const presets: ChronoPreset[] = Object.values(modules).map(injectIds);
