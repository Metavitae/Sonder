import { useCallback, useMemo, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5; // odd, center row is the selected value
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MIN_YEAR = 1920;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_AGE = 18;

function daysInMonth(monthIndex: number, year: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function isAtLeastAge(birth: Date, minAge: number, today: Date): boolean {
  const cutoff = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  return birth.getTime() <= cutoff.getTime();
}

// One scrollable column (month, day, or year), reused for all three.
//
// Real risk this addresses (flagged in the plan, worth the extra code):
// FlatList's snapToInterval + onMomentumScrollEnd alone isn't reliably the
// "final settled value" on every Android OEM skin — a short drag can end
// scrolling without a momentum phase ever firing, and native snap can
// overshoot by a row. So: (1) a continuous onScroll tracker commits/haptics
// on every index crossing, not just at the end; (2) onScrollEndDrag commits
// too when the drag's release velocity is already ~0 (no further momentum
// coming); (3) onMomentumScrollEnd, when it does fire, both commits AND
// force-corrects the scroll position to the exact snapped offset — so even
// a native under/overshoot self-heals to a pixel-exact rest position.
function WheelColumn({
  items,
  selectedIndex,
  onChange,
  width,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width: number;
}) {
  const listRef = useRef<FlatList<string>>(null);
  const lastCommittedRef = useRef(selectedIndex);

  const commit = useCallback(
    (rawIndex: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, rawIndex));
      if (clamped !== lastCommittedRef.current) {
        Haptics.selectionAsync();
        lastCommittedRef.current = clamped;
        onChange(clamped);
      }
    },
    [items.length, onChange]
  );

  const indexFromOffset = (offsetY: number) => Math.round(offsetY / ITEM_HEIGHT);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      commit(indexFromOffset(e.nativeEvent.contentOffset.y));
    },
    [commit]
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = indexFromOffset(e.nativeEvent.contentOffset.y);
      commit(index);
      listRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: true });
    },
    [commit]
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(velocityY) < 0.05) handleMomentumEnd(e);
    },
    [handleMomentumEnd]
  );

  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={(_, i) => String(i)}
      style={{ width }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
      initialScrollIndex={selectedIndex}
      contentContainerStyle={{ paddingVertical: PADDING }}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onMomentumScrollEnd={handleMomentumEnd}
      onScrollEndDrag={handleScrollEndDrag}
      renderItem={({ item, index }) => (
        <View style={styles.item}>
          <Text style={[styles.itemText, index === selectedIndex && styles.itemTextSelected]}>
            {item}
          </Text>
        </View>
      )}
    />
  );
}

export function BirthdateWheelPicker({
  value,
  onChange,
}: {
  value: Date;
  // Passes the picked date AND whether it currently clears the 18+ gate —
  // Stage 1 blocks continuing past setup while isAdult is false (Part 39:
  // "Sonder is 18+ only", locked).
  onChange: (date: Date, isAdult: boolean) => void;
}) {
  const monthIndex = value.getMonth();
  const day = value.getDate();
  const year = value.getFullYear();

  const dayItems = useMemo(
    () => Array.from({ length: daysInMonth(monthIndex, year) }, (_, i) => String(i + 1)),
    [monthIndex, year]
  );
  const yearItems = useMemo(
    () => Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) => String(MIN_YEAR + i)),
    []
  );

  const commitDate = useCallback(
    (nextMonthIndex: number, nextDay: number, nextYear: number) => {
      const maxDay = daysInMonth(nextMonthIndex, nextYear);
      const clampedDay = Math.min(nextDay, maxDay);
      const next = new Date(nextYear, nextMonthIndex, clampedDay);
      onChange(next, isAtLeastAge(next, MIN_AGE, new Date()));
    },
    [onChange]
  );

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.selectionBand} />
      <WheelColumn
        items={MONTHS}
        selectedIndex={monthIndex}
        onChange={(i) => commitDate(i, day, year)}
        width={140}
      />
      <WheelColumn
        items={dayItems}
        selectedIndex={day - 1}
        onChange={(i) => commitDate(monthIndex, i + 1, year)}
        width={64}
      />
      <WheelColumn
        items={yearItems}
        selectedIndex={year - MIN_YEAR}
        onChange={(i) => commitDate(monthIndex, day, MIN_YEAR + i)}
        width={90}
      />
    </View>
  );
}

export function isBirthdateAdult(date: Date, today: Date = new Date()): boolean {
  return isAtLeastAge(date, MIN_AGE, today);
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    height: PICKER_HEIGHT,
  },
  selectionBand: {
    position: "absolute",
    top: PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#D4AF7A",
    opacity: 0.6,
  },
  item: { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
  itemText: { color: "#8886a0", fontSize: 17 },
  itemTextSelected: { color: "#fff", fontWeight: "700" },
});
