import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Directory, File, Paths } from "expo-file-system";
import { talkSpanish } from "./i18n";

// Photos in the diary (founder, 2026-09-27/28): the user pastes a photo
// onto a page — taken now or picked from the gallery. It's shrunk and kept
// in the app's own private folder on this phone, drawn on the page, and
// sent to the server exactly once so Sonder can look at it and write itself
// a few words to remember it by (server/src/groq.ts describePhoto). After
// that only those words ever travel; the photo never leaves again.

const API_BASE_URL = process.env.EXPO_PUBLIC_SONDER_API_URL ?? "";

// Big enough to look good on a pocket-notebook page, small enough to send
// once and store by the hundreds.
const PHOTO_WIDTH = 1024;
const PHOTO_QUALITY = 0.6;

export type DiaryPhoto = { uri: string; base64: string };

function photosDir(): Directory {
  const dir = new Directory(Paths.document, "diary-photos");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

// Opens the camera or the gallery; null if the user backs out or says no.
export async function pickDiaryPhoto(source: "camera" | "library"): Promise<DiaryPhoto | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || !result.assets?.[0]) return null;

  const context = ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: PHOTO_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) return null;

  const kept = new File(photosDir(), `${Date.now()}.jpg`);
  new File(saved.uri).move(kept);
  return { uri: kept.uri, base64: saved.base64 };
}

// Sonder's one look at the photo.
export async function describeDiaryPhoto(base64: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, spanish: talkSpanish() }),
  });
  if (!res.ok) throw new Error(`server responded ${res.status}`);
  const data = (await res.json()) as { description?: unknown };
  if (typeof data.description !== "string") throw new Error("no description in response");
  return data.description;
}
