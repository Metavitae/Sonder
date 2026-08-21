import { StyleSheet, View } from "react-native";

import type { MistColor } from "../../lib/mistAtlas";
import { FogGemSwatch } from "./FogGemSwatch";

export type FogGemOption = { color: MistColor; label: string };

// Generic gem-exhibit picker — the caller supplies which options to show
// (varying count/labels per use, e.g. Stage 1's gender pickers: Male/
// Female/Not specified for the user, Male/Female for Sonder — per the
// founder's direct correction, 2026-08-20, superseding the earlier
// same-five-colors-for-both-pickers design). The mist-fog visual mechanic
// itself is unchanged; only which MistColor/label pairs are offered varies.
export function FogGemPicker({
  options,
  selected,
  onSelect,
  idPrefix,
}: {
  options: FogGemOption[];
  selected: MistColor | null;
  onSelect: (color: MistColor) => void;
  // Distinguishes this picker's swatches' SVG clipPath ids from any other
  // FogGemPicker mounted at the same time (e.g. user-gender and Sonder-
  // gender pickers both live on Stage 1 at once).
  idPrefix: string;
}) {
  return (
    <View style={styles.row}>
      {options.map(({ color, label }) => (
        <FogGemSwatch
          key={color}
          color={color}
          label={label}
          selected={selected === color}
          onSelect={() => onSelect(color)}
          idSuffix={`${idPrefix}-${color}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
});
