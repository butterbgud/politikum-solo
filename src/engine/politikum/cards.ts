import type { PolitikumCardType } from '../politikum';
import { POLITIKUM_YAML_CARDS, type PolitikumYamlCardDef } from './cards.generated';

export type PolitikumCardDef = {
  id: string;                 // e.g. persona_12
  type: PolitikumCardType;    // persona | action | event
  vp: number;                 // printed victory points
  count?: number;             // number of physical copies in the deck (defaults to 1)
  tags?: string[];            // faction/traits
  text?: string;              // rules text
  timing?: string;            // informational
  abilityKey?: string;        // e.g. draw_1
  params?: Record<string, any>;
};

export const POLITIKUM_CARDS_LIST: PolitikumCardDef[] = (POLITIKUM_YAML_CARDS as PolitikumYamlCardDef[]).map((c) => ({
  id: String(c.id),
  type: c.type as PolitikumCardType,
  vp: Number(c.vp ?? 0),
  count: c.count == null ? undefined : Number(c.count),
  tags: Array.isArray(c.tags) ? c.tags.map(String) : undefined,
  text: c.text == null ? undefined : String(c.text),
  timing: c.timing == null ? undefined : String(c.timing),
  abilityKey: c.abilityKey == null ? undefined : String(c.abilityKey),
  params: c.params == null ? undefined : (c.params as any),
}));

export const POLITIKUM_CARDS: Record<string, PolitikumCardDef> = Object.fromEntries(
  POLITIKUM_CARDS_LIST.map((c) => [c.id, c])
);

export function getPolitikumCardDef(id: string): PolitikumCardDef | null {
  return POLITIKUM_CARDS[id] || null;
}
