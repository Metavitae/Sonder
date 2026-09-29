import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";

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
  SONDER_FONT,
  SONDER_INK,
  USER_FONT,
  sonderInk,
  userInk,
} from "../../lib/diaryInk";
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
};

function lineStyle(role: "user" | "sonder") {
  return role === "sonder" ? styles.sonderText : styles.userText;
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
  },
  ref
) {
  const textWidth = pageWidth - BOOK_MARGIN * 2 - PAD_X * 2;
  const pageHeight = bookHeight - BOOK_MARGIN * 2;
  const linesPerPage = Math.max(8, Math.floor((pageHeight - PAD_TOP - PAD_BOTTOM) / LINE));
  const paperStyle = PAPER_STYLE[paper];

  // --- Measuring: the real text engine breaks each entry into lines at the
  // page's exact width; the result is cached per entry so each is measured
  // once. Pages are only drawn once everything stored has been measured.
  const measuredRef = useRef(new Map<string, string[]>());
  const [measureTick, setMeasureTick] = useState(0);
  const widthRef = useRef(textWidth);
  if (widthRef.current !== textWidth) {
    widthRef.current = textWidth;
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
    return cut;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, linesPerPage, measureTick]);
  const lastIndex = pages.length - 1;

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
    },
    [lastIndex, onLatestChange]
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

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
  const rootRef = useRef<View>(null);
  const [visibleHeight, setVisibleHeight] = useState(bookHeight);
  const [inputLines, setInputLines] = useState(1);
  // Founder, 2026-09-28 (tested on the POCO): a long message kept growing
  // behind the keyboard. The space left for writing is now measured
  // directly — from the top of the book to the keyboard's top edge — and
  // the line count comes from an invisible copy of the text (below), not
  // the input's own size reports.
  const [keyboard, setKeyboard] = useState<{ top: number; height: number } | null>(null);
  const [bookTop, setBookTop] = useState<number | null>(null);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboard({ top: e.endCoordinates.screenY, height: e.endCoordinates.height });
      rootRef.current?.measureInWindow((_x, y) => setBookTop(y));
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(null));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const spaceAboveKeyboard =
    keyboard && bookTop !== null ? Math.min(visibleHeight, keyboard.top - bookTop) : visibleHeight;
  // The writing box stops at whichever comes first — the page's last ruled
  // line, or what fits above the keyboard (keeping one line of what came
  // before in view) — and scrolls inside itself past that.
  const pageLinesLeft = linesPerPage - lastPageRows;
  const fitLines = keyboardOpen ? Math.floor((spaceAboveKeyboard - LINE / 2) / LINE) - 1 : pageLinesLeft;
  const inputMaxLines = Math.max(2, Math.min(pageLinesLeft, fitLines));
  useEffect(() => {
    if (!keyboardOpen) {
      tiltRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const writingBottom =
      BOOK_MARGIN + PAD_TOP + (lastPageRows + Math.min(inputLines, inputMaxLines)) * LINE + LINE / 2;
    const y = Math.max(0, writingBottom - spaceAboveKeyboard);
    tiltRef.current?.scrollTo({ y, animated: true });
  }, [keyboardOpen, spaceAboveKeyboard, lastPageRows, inputLines, inputMaxLines]);

  const renderRow = (row: DiaryRow, i: number) => {
    if (row.kind === "photo") {
      // Tucked onto the page like a snapshot, a little crooked, never cut.
      return (
        <View key={i} style={styles.photoRow}>
          <View style={styles.photoFrame}>
            <Image source={{ uri: row.uri }} style={styles.photo} contentFit="cover" />
          </View>
        </View>
      );
    }
    if (row.kind === "date") {
      return (
        <Text key={i} style={[styles.row, styles.dateText, { color: paperStyle.faint }]} numberOfLines={1}>
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
          lineStyle(row.role),
          { color },
          row.tone === "pending" && styles.pending,
          row.tone === "dream" && styles.dream,
        ]}
        numberOfLines={1}
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
            { backgroundColor: paperStyle.page, shadowColor: SONDER_INK[feeling] },
          ]}
        >
          {Array.from({ length: linesPerPage }, (_, k) => (
            <View
              key={k}
              style={[styles.rule, { top: PAD_TOP + (k + 1) * LINE - 1, backgroundColor: paperStyle.rule }]}
            />
          ))}
          <View style={styles.writing}>
            {item.map(renderRow)}
            {isLast && (
              <View>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    styles.userText,
                    { color: userInk(paper), maxHeight: inputMaxLines * LINE },
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
                    <Text style={[styles.sendText, { color: sonderInk(feeling, paper) }]}>↵</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
          <Text style={[styles.pageNumber, { color: paperStyle.faint }]}>{index + 1}</Text>
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
    <View ref={rootRef} style={styles.flex}>
      {
        // Invisible measuring pass — same width and type as the page.
      }
      <View style={[styles.measure, { width: textWidth - INPUT_PAD_RIGHT }]} pointerEvents="none">
        <Text
          style={[styles.measureText, styles.userText]}
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
              style={[styles.measureText, lineStyle(e.role)]}
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
  sonderText: { fontFamily: SONDER_FONT, fontSize: 15 },
  userText: { fontFamily: USER_FONT, fontSize: 21 },
  dateText: { fontSize: 13, fontStyle: "italic", letterSpacing: 0.3 },
  pending: { opacity: 0.55 },
  dream: { fontStyle: "italic", opacity: 0.75 },
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
  measureText: { lineHeight: LINE, includeFontPadding: false },
});
