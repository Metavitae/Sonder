import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
// Diary build order step 2 (founder, 2026-09-27/28): ribbon bookmarks, placed
// by the user only (Sonder doesn't mark pages — founder's pick, 2026-09-28).
// The ribbon is the user's, so it's one classic dark red (RIBBON_RED), never
// Sonder's feeling color — Sonder's feelings stay in its ink and the mist.
// A ribbon is anchored to the writing it marks (which entry, which of its
// lines), never to a page number — pages re-cut whenever type size or page
// width changes, and the ribbon has to stay with its words. Local only,
// same storage conventions as the other sonder_ keys.
const STORAGE_KEY = "sonder_diary_bookmarks_v1";

export type Bookmark = {
  entryKey: string;
  lineIdx: number;
  // For the ribbon list: when the marked writing was written, and its
  // first words.
  at?: number;
  label: string;
};

export function bookmarkId(b: { entryKey: string; lineIdx: number }): string {
  return `${b.entryKey}:${b.lineIdx}`;
}

function isBookmark(b: unknown): b is Bookmark {
  const v = b as Bookmark;
  return !!v && typeof v.entryKey === "string" && typeof v.lineIdx === "number" && typeof v.label === "string";
}

export function useDiaryBookmarks(): {
  bookmarks: Bookmark[];
  addBookmark: (b: Bookmark) => void;
  removeBookmarks: (ids: string[]) => void;
} {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setBookmarks(parsed.filter(isBookmark));
      })
      .catch(() => {});
  }, []);

  const save = (next: Bookmark[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    return next;
  };

  const addBookmark = useCallback((b: Bookmark) => {
    setBookmarks((prev) =>
      prev.some((p) => bookmarkId(p) === bookmarkId(b)) ? prev : save([...prev, b])
    );
  }, []);

  const removeBookmarks = useCallback((ids: string[]) => {
    setBookmarks((prev) => save(prev.filter((p) => !ids.includes(bookmarkId(p)))));
  }, []);

  return { bookmarks, addBookmark, removeBookmarks };
}
