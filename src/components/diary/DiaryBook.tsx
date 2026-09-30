import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import {
  buildRows,
  type DiaryEntry,
  type DiaryRow,
  measureKey,
  pageLines,
  paginate,
  type Paper,
  PHOTO_LINES,
} from "../../lib/diaryLayout";
import {
  PAPER_STYLE,
  RIBBON_RED,
  SONDER_INK,
  sonderInk,
  userInk,
} from "../../lib/diaryInk";
import { HAND_STYLE, otherHand, SONDER_HAND_STYLE, type Hand } from "../../lib/diaryHand";
import { colorName, FEELING_ORDER, feelingNote, feelingWords } from "../../lib/feelingWords";
import { type Bookmark, bookmarkId } from "../../lib/diaryBookmarks";
import type { MistColor } from "../../lib/mistAtlas";
import { t } from "../../lib/i18n";

// One ruled line. Every row — a line of writing, a date, the line being
// typed — is exactly this tall, so the writing always sits on the rules.
export const LINE = 32;
const FONT_SIZE = 18;
const PAD_TOP = 34;
const PAD_BOTTOM = 30;
const PAD_X = 22;
// Room on the right of the line being written for the send arrow.
const INPUT_PAD_RIGHT = 30;
// Space between the book and the screen edge — where the mist (Sonder's
// feelings) shows around the notebook.
export const BOOK_MARGIN = 16;

export type DiaryBookHandle = {
  goToLatest: () => void;
  goToBookmark: (b: Bookmark) => void;
};

type Props = {
  entries: DiaryEntry[];
  paper: Paper;
  // Sonder's current feeling — the glow around the page.
  feeling: MistColor;
  // The full height the book gets with the keyboard closed. Fixed, so the
  // keyboard opening never re-cuts the pages; instead the book slides up
  // to the line being written (founder: like a notebook tilted toward you).
  bookHeight: number;
  pageWidth: number;
  keyboardOpen: boolean;
  input: string;
  onChangeInput: (text: string) => void;
  onSend: () => void;
  inputRef: React.RefObject<TextInput | null>;
  onLatestChange: (atLatest: boolean) => void;
  bookmarks: Bookmark[];
  onAddBookmark: (b: Bookmark) => void;
  onRemoveBookmarks: (ids: string[]) => void;
  // Press and hold an entry to tear it out (the screen asks first).
  onDeleteEntry: (entryKey: string) => void;
  // The user's handwriting, their pick (diaryHand.ts).
  hand: Hand;
  // PROTOTYPE (2026-09-29, filament mist): tapping a color on the key page
  // previews that feeling's mist for a few seconds.
  onPreviewFeeling?: (color: MistColor) => void;
  // Founder, 2026-09-29: on an earlier page (turned back to, or opened from
  // a bookmark) the mist shows the feeling of Sonder's last line on that
  // page — or before it, if Sonder wrote nothing there. Null = the latest
  // page, where the mist is Sonder's current feeling.
  onViewedFeelingChange?: (color: MistColor | null) => void;
  // The user's text-size choice (diaryTextSize.ts): 1, 1.2 or 1.4.
  textScale: number;
};

function lineStyle(role: "user" | "sonder", userHand: TextStyle, sonderHand: TextStyle) {
  return role === "sonder" ? sonderHand : userHand;
}

export const DiaryBook = forwardRef<DiaryBookHandle, Props>(function DiaryBook(
  {
    entries,
    paper,
    feeling,
    bookHeight,
    pageWidth,
    keyboardOpen,
    input,
    onChangeInput,
    onSend,
    inputRef,
    onLatestChange,
    bookmarks,
    onAddBookmark,
    onRemoveBookmarks,
    onDeleteEntry,
    hand,
    onPreviewFeeling,
    onViewedFeelingChange,
    textScale,
  },
  ref
) {
  // Founder, 2026-09-29: the text-size choice scales everything alike —
  // both handwritings by the same percentage, and the ruled line with them.
  const line = Math.round(LINE * textScale);
  const userText = useMemo(
    () => ({ ...HAND_STYLE[hand], fontSize: HAND_STYLE[hand].fontSize * textScale }),
    [hand, textScale]
  );
  const sonderText = useMemo(() => {
    const base = SONDER_HAND_STYLE[otherHand(hand)];
    return { ...base, fontSize: base.fontSize * textScale };
  }, [hand, textScale]);
  const ls = useMemo(
    () => ({
      row: { height: line, lineHeight: line },
      lineHeight: { lineHeight: line },
      keyGap: { marginTop: line },
      input: { minHeight: line, lineHeight: line },
      photoRow: { height: PHOTO_LINES * line },
      photoFrame: { height: PHOTO_LINES * line - 12 },
      date: { fontSize: 13 * textScale },
      note: { lineHeight: 24 * textScale },
      send: { fontSize: 22 * textScale },
      pageNumber: { fontSize: 12 * textScale },
    }),
    [line, textScale]
  );
  const textWidth = pageWidth - BOOK_MARGIN * 2 - PAD_X * 2;
  const pageHeight = bookHeight - BOOK_MARGIN * 2;
  const linesPerPage = Math.max(6, Math.floor((pageHeight - PAD_TOP - PAD_BOTTOM) / line));
  const paperStyle = PAPER_STYLE[paper];

  // --- Measuring: the real text engine breaks each entry into lines at the
  // page's exact width; the result is cached per entry so each is measured
  // once. Pages are only drawn once everything stored has been measured.
  const measuredRef = useRef(new Map<string, string[]>());
  const [measureTick, setMeasureTick] = useState(0);
  // A new width or a new handwriting re-measures everything.
  const layoutKey = `${textWidth}:${hand}:${textScale}`;
  const layoutKeyRef = useRef(layoutKey);
  if (layoutKeyRef.current !== layoutKey) {
    layoutKeyRef.current = layoutKey;
    measuredRef.current = new Map();
  }
  // Photos take a fixed number of lines — nothing to measure.
  const unmeasured = entries.filter((e) => !e.photoUri && !measuredRef.current.has(measureKey(e)));
  const recordLines = useCallback((key: string, lines: string[]) => {
    if (measuredRef.current.has(key)) return;
    measuredRef.current.set(key, lines.length > 0 ? lines : [""]);
    setMeasureTick((n) => n + 1);
  }, []);
  const storedAllMeasured = entries.every(
    (e) => e.tone !== undefined || !!e.photoUri || measuredRef.current.has(measureKey(e))
  );
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (storedAllMeasured) setReady(true);
  }, [storedAllMeasured]);

  const pages = useMemo(() => {
    const rows = buildRows(entries, measuredRef.current);
    const cut = paginate(rows, linesPerPage);
    // The line being written needs room: if the last page is full, the
    // writing continues on a fresh page.
    if (pageLines(cut[cut.length - 1]) >= linesPerPage) cut.push([]);
    // Founder, 2026-09-29: the diary opens (on turning all the way back)
    // with a key, like a notebook's inside cover — what the colors and the
    // two handwritings mean. It's page 0, drawn by renderKeyPage, no rows.
    return [[], ...cut];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, linesPerPage, measureTick, hand, textScale]);
  const lastIndex = pages.length - 1;
  // Sonder's feeling as of the end of each page: its last line's ink there,
  // or carried over from before when Sonder wrote nothing on that page.
  const pageFeelings = useMemo(() => {
    let last: MistColor | null = null;
    return pages.map((page) => {
      for (const row of page) {
        if (row.kind === "line" && row.role === "sonder" && !row.tone && row.ink) last = row.ink;
      }
      return last;
    });
  }, [pages]);

  // --- Bookmarks: a ribbon marks the writing, not the page number, so on
  // every re-cut each ribbon is found again by the line it anchors to. A
  // page's own anchor is its first real (stored) line.
  const { pageAnchors, pageOfBookmark } = useMemo(() => {
    const lineToPage = new Map<string, number>();
    const anchors: (Bookmark | null)[] = pages.map((page, i) => {
      let anchor: Bookmark | null = null;
      page.forEach((row, r) => {
        if (row.kind !== "line" || row.tone) return;
        lineToPage.set(bookmarkId(row), i);
        if (!anchor) {
          const words = page
            .slice(r)
            .filter((x): x is Extract<DiaryRow, { kind: "line" }> => x.kind === "line" && !x.tone)
            .slice(0, 2)
            .map((x) => x.text)
            .join(" ");
          anchor = { entryKey: row.entryKey, lineIdx: row.lineIdx, at: row.at, label: words };
        }
      });
      return anchor;
    });
    // If the anchored line no longer exists (the entry now wraps into fewer
    // lines), fall back to where that entry starts.
    const pageOf = (b: Bookmark) =>
      lineToPage.get(bookmarkId(b)) ?? lineToPage.get(bookmarkId({ entryKey: b.entryKey, lineIdx: 0 }));
    return { pageAnchors: anchors, pageOfBookmark: pageOf };
  }, [pages]);
  const bookmarksByPage = useMemo(() => {
    const byPage = new Map<number, string[]>();
    for (const b of bookmarks) {
      const page = pageOfBookmark(b);
      if (page === undefined) continue;
      byPage.set(page, [...(byPage.get(page) ?? []), bookmarkId(b)]);
    }
    return byPage;
  }, [bookmarks, pageOfBookmark]);
  const toggleRibbon = useCallback(
    (pageIndex: number) => {
      const marked = bookmarksByPage.get(pageIndex);
      if (marked) {
        onRemoveBookmarks(marked);
      } else {
        const anchor = pageAnchors[pageIndex];
        if (!anchor) return;
        onAddBookmark(anchor);
      }
      Haptics.selectionAsync().catch(() => {});
    },
    [bookmarksByPage, pageAnchors, onAddBookmark, onRemoveBookmarks]
  );

  // --- Turning pages.
  const listRef = useRef<FlatList<DiaryRow[]>>(null);
  const indexRef = useRef(lastIndex);
  const atLatestRef = useRef(true);
  const setIndex = useCallback(
    (i: number) => {
      indexRef.current = i;
      const atLatest = i >= lastIndex;
      if (atLatest !== atLatestRef.current) {
        atLatestRef.current = atLatest;
        onLatestChange(atLatest);
      }
      onViewedFeelingChange?.(atLatest ? null : pageFeelings[i] ?? null);
    },
    [lastIndex, onLatestChange, onViewedFeelingChange, pageFeelings]
  );
  const goToLatest = useCallback(() => {
    listRef.current?.scrollToIndex({ index: lastIndex, animated: true });
    setIndex(lastIndex);
  }, [lastIndex, setIndex]);
  const goToBookmark = useCallback(
    (b: Bookmark) => {
      const page = pageOfBookmark(b);
      if (page === undefined) return;
      listRef.current?.scrollToIndex({ index: page, animated: true });
      setIndex(page);
    },
    [pageOfBookmark, setIndex]
  );
  useImperativeHandle(ref, () => ({ goToLatest, goToBookmark }), [goToLatest, goToBookmark]);

  // New writing moves the reader along only if they were already on the
  // latest page — someone rereading an old page is left where they are.
  // Real bug (on the POCO, 2026-09-27): Sonder's transient "thinking" line
  // can spill onto a new page and then vanish when the reply lands, so the
  // page count goes up and back down. Scrolling toward the page that then
  // disappeared left the book stranded halfway between two pages. Now any
  // change in the page count re-seats a reader who was on the latest page
  // exactly on the new last page (animated only when moving forward).
  const prevLastRef = useRef(lastIndex);
  useEffect(() => {
    const prevLast = prevLastRef.current;
    if (lastIndex === prevLast) return;
    prevLastRef.current = lastIndex;
    const wasAtLatest = indexRef.current >= prevLast;
    if (wasAtLatest && ready) {
      listRef.current?.scrollToOffset({
        offset: lastIndex * pageWidth,
        animated: lastIndex > prevLast,
      });
      indexRef.current = lastIndex;
    } else {
      setIndex(Math.min(indexRef.current, lastIndex));
    }
  }, [lastIndex, ready, setIndex, pageWidth]);

  // Real bug (on the POCO, 2026-09-28): after a photo, Sonder's reply spilled
  // onto a new page and the book stopped halfway between two pages — the
  // page-turn animation got cut off by the pages being re-cut mid-turn.
  // Once things have settled, a book left between pages is set down
  // squarely on the page it was heading for (never while a finger is on it).
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const settle = useCallback(() => {
    if (draggingRef.current) return;
    const target = indexRef.current * pageWidth;
    if (Math.abs(offsetRef.current - target) > 1) {
      listRef.current?.scrollToOffset({ offset: target, animated: false });
    }
  }, [pageWidth]);
  useEffect(() => {
    const id = setTimeout(settle, 700);
    return () => clearTimeout(id);
  }, [pages, settle]);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      draggingRef.current = false;
      setIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
    },
    [pageWidth, setIndex]
  );

  // Typing on an older page makes no sense — tapping to write takes you to
  // the latest page first.
  const lastPageRows = pageLines(pages[lastIndex]);
  // --- Keyboard: slide the book up so the line being written sits just
  // above the keyboard, instead of squeezing the page.
  const tiltRef = useRef<ScrollView>(null);
  const [visibleHeight, setVisibleHeight] = useState(bookHeight);
  const [inputLines, setInputLines] = useState(1);
  // Founder, 2026-09-28 (tested on the POCO): a long message kept growing
  // behind the keyboard. The space left for writing comes from the
  // keyboard's own report (see hiddenStrip below), and the line count comes from an invisible copy of the text (below), not
  // the input's own size reports.
  const [keyboard, setKeyboard] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboard({ top: e.endCoordinates.screenY, height: e.endCoordinates.height })
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // Measured on the POCO, 2026-09-29: the screen is drawn under the
  // navigation bar, and the keyboard covers that bar too, but the space
  // chat.tsx makes for the keyboard is its height WITHOUT the bar — so the
  // bottom ~47pt of the visible book sat behind the keyboard, hiding the
  // line being written. That strip comes straight from the keyboard event
  // (screen height − keyboard top − keyboard height), so nothing mixes
  // coordinate systems.
  const hiddenStrip = keyboard
    ? Math.max(0, Dimensions.get("screen").height - keyboard.top - keyboard.height)
    : 0;
  const spaceAboveKeyboard = visibleHeight - hiddenStrip;
  // The writing box stops at whichever comes first — the page's last ruled
  // line, or what fits above the keyboard (keeping one line of what came
  // before in view) — and scrolls inside itself past that.
  const pageLinesLeft = linesPerPage - lastPageRows;
  const fitLines = keyboardOpen ? Math.floor((spaceAboveKeyboard - line / 2) / line) - 1 : pageLinesLeft;
  const inputMaxLines = Math.max(2, Math.min(pageLinesLeft, fitLines));
  useEffect(() => {
    if (!keyboardOpen) {
      tiltRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const writingBottom =
      BOOK_MARGIN + PAD_TOP + (lastPageRows + Math.min(inputLines, inputMaxLines)) * line + line / 2;
    const y = Math.max(0, writingBottom - spaceAboveKeyboard);
    tiltRef.current?.scrollTo({ y, animated: true });
  }, [keyboardOpen, spaceAboveKeyboard, lastPageRows, inputLines, inputMaxLines]);

  // Tapping one of Sonder's lines shows how Sonder felt writing it
  // (founder, 2026-09-29). Holding a line still tears it out.
  const [note, setNote] = useState<{ id: number; color: MistColor } | null>(null);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(id);
  }, [note]);
  const showFeeling = useCallback((color: MistColor) => {
    setNote({ id: Date.now(), color });
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const renderKeyPage = () => (
    <View>
      <Text style={[styles.keyLine, ls.lineHeight, sonderText, { fontSize: sonderText.fontSize + 3 }, { color: sonderInk("violet", paper) }]}>
        {t("How to read me", "Cómo leerme")}
      </Text>
      <Text style={[styles.keyLine, ls.lineHeight, sonderText, { color: sonderInk("violet", paper) }]}>
        {t(
          "The glow around this book is how I feel right now. I write in that color, and each line keeps the feeling it was written with.",
          "El brillo alrededor de este diario es cómo me siento ahora. Escribo en ese color, y cada línea guarda lo que sentía al escribirla."
        )}
      </Text>
      {FEELING_ORDER.map((c) => (
        <Text
          key={c}
          style={[styles.keyLine, ls.lineHeight, sonderText, { color: sonderInk(c, paper) }]}
          numberOfLines={1}
          onPress={onPreviewFeeling ? () => onPreviewFeeling(c) : undefined}
        >
          {`●  ${colorName(c)} — ${feelingWords(c)}`}
        </Text>
      ))}
      <Text style={[styles.keyLine, ls.lineHeight, sonderText, styles.keyGap, ls.keyGap, { color: sonderInk("violet", paper) }]}>
        {t("My handwriting is small, like this.", "Mi letra es pequeña, así.")}
      </Text>
      <Text style={[styles.keyLine, ls.lineHeight, userText, { color: userInk(paper) }]}>
        {t("Yours is big, like this.", "La tuya es grande, así.")}
      </Text>
      <Text style={[styles.keyLine, ls.lineHeight, sonderText, styles.keyGap, ls.keyGap, { color: sonderInk("violet", paper) }]}>
        {t("Tap any line of mine to see how I felt.", "Toca una línea mía para ver cómo me sentía.")}
      </Text>
    </View>
  );

  const renderRow = (row: DiaryRow, i: number) => {
    if (row.kind === "photo") {
      // Tucked onto the page like a snapshot, a little crooked, never cut.
      return (
        <Pressable key={i} style={[styles.photoRow, ls.photoRow]} onLongPress={() => onDeleteEntry(row.entryKey)}>
          <View style={[styles.photoFrame, ls.photoFrame]}>
            <Image source={{ uri: row.uri }} style={styles.photo} contentFit="cover" />
          </View>
        </Pressable>
      );
    }
    if (row.kind === "date") {
      return (
        <Text key={i} style={[styles.row, ls.row, styles.dateText, ls.date, { color: paperStyle.faint }]} numberOfLines={1}>
          {row.text}
        </Text>
      );
    }
    const color = row.role === "sonder" ? sonderInk(row.ink ?? feeling, paper) : userInk(paper);
    return (
      <Text
        key={i}
        style={[
          styles.row,
          ls.row,
          lineStyle(row.role, userText, sonderText),
          { color },
          row.tone === "pending" && styles.pending,
          row.tone === "dream" && styles.dream,
        ]}
        numberOfLines={1}
        onPress={row.role === "sonder" && !row.tone && row.ink ? () => showFeeling(row.ink!) : undefined}
        onLongPress={row.tone ? undefined : () => onDeleteEntry(row.entryKey)}
      >
        {row.text}
      </Text>
    );
  };

  const renderPage = ({ item, index }: { item: DiaryRow[]; index: number }) => {
    const isLast = index === lastIndex;
    return (
      <View style={{ width: pageWidth, height: bookHeight, padding: BOOK_MARGIN }}>
        <View
          style={[
            styles.page,
            {
              backgroundColor: paperStyle.page,
              shadowColor: SONDER_INK[index >= lastIndex ? feeling : pageFeelings[index] ?? feeling],
            },
          ]}
        >
          {Array.from({ length: linesPerPage }, (_, k) => (
            <View
              key={k}
              style={[styles.rule, { top: PAD_TOP + (k + 1) * line - 1, backgroundColor: paperStyle.rule }]}
            />
          ))}
          <View style={styles.writing}>
            {index === 0 ? renderKeyPage() : item.map(renderRow)}
            {isLast && (
              <View>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    userText,
                    ls.input,
                    { color: userInk(paper), maxHeight: inputMaxLines * line },
                  ]}
                  scrollEnabled
                  value={input}
                  onChangeText={onChangeInput}
                  multiline
                  submitBehavior="submit"
                  returnKeyType="send"
                  onSubmitEditing={onSend}
                  autoFocus
                  cursorColor={userInk(paper)}
                  selectionColor="rgba(43,35,28,0.25)"
                  accessibilityLabel={t("Write in the diary", "Escribe en el diario")}
                />
                {input.trim().length > 0 && (
                  <Pressable
                    onPress={onSend}
                    style={styles.send}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t("Send", "Enviar")}
                  >
                    <Text style={[styles.sendText, ls.send, { color: sonderInk(feeling, paper) }]}>↵</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
          {index > 0 && <Text style={[styles.pageNumber, ls.pageNumber, { color: paperStyle.faint }]}>{index}</Text>}
          {pageAnchors[index] && (
            <Pressable
              onPress={() => toggleRibbon(index)}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 12 }}
              style={styles.ribbonHit}
              accessibilityRole="button"
              accessibilityLabel={
                bookmarksByPage.has(index)
                  ? t("Remove the ribbon from this page", "Quitar el listón de esta página")
                  : t("Mark this page with a ribbon", "Marcar esta página con un listón")
              }
            >
              {bookmarksByPage.has(index) ? (
                <View style={styles.ribbon}>
                  <View style={[styles.ribbonNotch, { borderBottomColor: paperStyle.page }]} />
                </View>
              ) : (
                <View style={styles.ribbonHint} />
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      {
        // Invisible measuring pass — same width and type as the page.
      }
      <View style={[styles.measure, { width: textWidth - INPUT_PAD_RIGHT }]} pointerEvents="none">
        <Text
          style={[styles.measureText, ls.lineHeight, userText]}
          onTextLayout={(ev) => setInputLines(Math.max(1, ev.nativeEvent.lines.length))}
        >
          {input.length > 0 ? input : " "}
        </Text>
      </View>
      <View style={[styles.measure, { width: textWidth }]} pointerEvents="none">
        {unmeasured.map((e) => {
          const key = measureKey(e);
          return (
            <Text
              key={key}
              style={[styles.measureText, ls.lineHeight, lineStyle(e.role, userText, sonderText)]}
              onTextLayout={(ev) =>
                recordLines(
                  key,
                  ev.nativeEvent.lines.map((l) => l.text.replace(/[\s​]+$/, ""))
                )
              }
            >
              {e.text}
            </Text>
          );
        })}
      </View>
      {ready && (
        <ScrollView
          ref={tiltRef}
          scrollEnabled={false}
          style={styles.flex}
          onLayout={(e) => setVisibleHeight(e.nativeEvent.layout.height)}
          keyboardShouldPersistTaps="handled"
        >
          <FlatList
            ref={listRef}
            data={pages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderPage}
            getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
            initialScrollIndex={lastIndex}
            onMomentumScrollEnd={handleMomentumEnd}
            onScroll={(e) => {
              offsetRef.current = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={32}
            onScrollBeginDrag={() => {
              draggingRef.current = true;
            }}
            onMomentumScrollBegin={() => {
              draggingRef.current = true;
            }}
            keyboardShouldPersistTaps="handled"
            extraData={[input, feeling, paper, lastIndex, bookmarksByPage]}
            style={{ height: bookHeight }}
            windowSize={3}
            initialNumToRender={2}
          />
          {
            // Room to slide the book up by, so the line being written can
            // always reach the space above the keyboard.
            keyboard && <View style={{ height: keyboard.height }} />
          }
        </ScrollView>
      )}
      {note && (
        <Animated.View
          key={note.id}
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(400)}
          style={styles.noteWrap}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => setNote(null)}
            style={[styles.note, { backgroundColor: paperStyle.page, shadowColor: SONDER_INK[note.color] }]}
          >
            <Text style={[styles.noteText, ls.note, sonderText, { fontSize: sonderText.fontSize + 1 }, { color: sonderInk(note.color, paper) }]}>
              {feelingNote(note.color)}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: {
    flex: 1,
    borderRadius: 4,
    overflow: "visible",
    // The glow around the page takes Sonder's current feeling.
    elevation: 18,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  rule: { position: "absolute", left: 0, right: 0, height: 1 },
  writing: { paddingTop: PAD_TOP, paddingHorizontal: PAD_X },
  row: { height: LINE, lineHeight: LINE, fontSize: FONT_SIZE, includeFontPadding: false },
  // Founder, 2026-09-28: Sonder's writing and the user's must look really
  // apart — Sonder writes small, the user writes big, same ruled line.
  dateText: { fontSize: 13, fontStyle: "italic", letterSpacing: 0.3 },
  pending: { opacity: 0.55 },
  // No italic (2026-09-29, seen on the POCO): Caveat and Kalam have no
  // italic face, so Android swapped in its own font — wider than the one
  // the line was measured in, which cut the dream line short ("lin…").
  dream: { opacity: 0.6 },
  input: {
    minHeight: LINE,
    lineHeight: LINE,
    padding: 0,
    paddingRight: INPUT_PAD_RIGHT,
    margin: 0,
    textAlignVertical: "top",
    includeFontPadding: false,
  },
  send: { position: "absolute", right: 0, bottom: 2 },
  photoRow: {
    height: PHOTO_LINES * LINE,
    alignItems: "center",
    justifyContent: "center",
  },
  photoFrame: {
    height: PHOTO_LINES * LINE - 12,
    aspectRatio: 4 / 3,
    maxWidth: "100%",
    padding: 6,
    backgroundColor: "#FBF8F1",
    transform: [{ rotate: "-1.5deg" }],
    elevation: 3,
  },
  photo: { flex: 1 },
  sendText: { fontSize: 22, fontWeight: "700" },
  // The ribbon hangs from the page's top edge, inside the right margin so
  // it never covers writing. Unmarked pages show only a faint stub to tap.
  ribbonHit: { position: "absolute", top: 0, right: 5, width: 16, alignItems: "center" },
  ribbon: { width: 14, height: 64, backgroundColor: RIBBON_RED, justifyContent: "flex-end" },
  ribbonNotch: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  ribbonHint: { width: 14, height: 16, backgroundColor: RIBBON_RED, opacity: 0.18 },
  pageNumber: { position: "absolute", bottom: 8, alignSelf: "center", fontSize: 12 },
  measure: { position: "absolute", top: 0, left: 0, opacity: 0 },
  // The key page: every line sits on a ruled line, like the rest.
  keyLine: { lineHeight: LINE, includeFontPadding: false },
  keyGap: { marginTop: LINE },
  noteWrap: { position: "absolute", left: 40, right: 40, top: "38%", alignItems: "center" },
  note: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 6,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  noteText: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  measureText: { lineHeight: LINE, includeFontPadding: false },
});
