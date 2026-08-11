import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export type MistColor = "violet" | "magenta" | "cyan" | "amber" | "blue";

const MIST_SOURCES: Record<MistColor, number> = {
  violet: require("../../assets/mist/mist_violet.webm"),
  magenta: require("../../assets/mist/mist_magenta.webm"),
  cyan: require("../../assets/mist/mist_cyan.webm"),
  amber: require("../../assets/mist/mist_amber.webm"),
  blue: require("../../assets/mist/mist_blue.webm"),
};

const TRANSITION_MS = 600;
// How long after a crossfade completes before the now-hidden slot's source
// is released. Must be >= TRANSITION_MS so the outgoing video is still
// decoding (and visible) for the full fade, not cut early.
const CLEAR_DELAY_MS = 650;

// Capped at two concurrent video decoders. Five simultaneous layers (the
// original live-mixed-primaries design) stalled real hardware at ~2s/frame
// with the camera + MediaPipe pipeline also running — see Log, 2026-08-06.
// The mist now crossfades between one color at a time instead of mixing all
// five as independent primaries. Both slots loop continuously whenever
// loaded so the mist never holds a static frame — constant movement is the
// point, since the mist IS Sonder's visible presence/mood; a frozen frame
// would read as absence, not calm.
type Controller = { setColor: (color: MistColor) => void };
let activeController: Controller | null = null;

export function setMistColor(color: MistColor) {
  activeController?.setColor(color);
}

function useMistSlot(initialSource: number, initialOpacity: number) {
  const player = useVideoPlayer(initialSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  const opacity = useSharedValue(initialOpacity);
  return { player, opacity };
}

export function AmbientMist({
  initialColor = "violet",
}: {
  initialColor?: MistColor;
}) {
  const slotA = useMistSlot(MIST_SOURCES[initialColor], 1);
  const slotB = useMistSlot(MIST_SOURCES[initialColor], 0);

  const frontRef = useRef<"A" | "B">("A");
  const currentColorRef = useRef<MistColor>(initialColor);

  useEffect(() => {
    const controller: Controller = {
      setColor(next) {
        if (next === currentColorRef.current) return;
        currentColorRef.current = next;

        const frontIsA = frontRef.current === "A";
        const incoming = frontIsA ? slotB : slotA;
        const outgoing = frontIsA ? slotA : slotB;

        incoming.player.replaceAsync(MIST_SOURCES[next]).then(() => {
          incoming.player.loop = true;
          incoming.player.muted = true;
          incoming.player.play();
        });

        incoming.opacity.value = withTiming(1, { duration: TRANSITION_MS });
        outgoing.opacity.value = withTiming(0, { duration: TRANSITION_MS });
        frontRef.current = frontIsA ? "B" : "A";

        setTimeout(() => {
          outgoing.player.replaceAsync(null);
        }, CLEAR_DELAY_MS);
      },
    };
    activeController = controller;
    return () => {
      if (activeController === controller) activeController = null;
    };
  }, [slotA, slotB]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <MistLayer player={slotA.player} opacity={slotA.opacity} />
      <MistLayer player={slotB.player} opacity={slotB.opacity} />
    </View>
  );
}

function MistLayer({
  player,
  opacity,
}: {
  player: VideoPlayer;
  opacity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />
    </Animated.View>
  );
}
