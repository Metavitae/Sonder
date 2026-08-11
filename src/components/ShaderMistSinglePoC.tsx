import { Canvas, Image } from "@shopify/react-native-skia";
import { useWindowDimensions } from "react-native";
import { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import { useVideo } from "@shopify/react-native-skia/lib/module/external/reanimated";

// TEMPORARY, evaluation-only, single-video variant of ShaderMistPoC.
// ShaderMistPoC (3 concurrent useVideo() calls, violet/cyan/amber blended)
// showed Render:0/DQout:0 on every MediaCodec Stats window in the combined
// camera+MediaPipe screen, a fully isolated screen with nothing else
// running, AND this same single-video screen with the original VP9 source —
// ruling out both camera/MediaPipe thread contention and decoder count as
// the cause (2026-08-10). Every one of those Stats lines named the same
// decoder component: c2.mtk.vp9.decoder, this device's MediaTek hardware
// VP9 decoder. Testing that specific hypothesis now: mist_violet_h264.mp4
// is the SAME source clip (180x320/10fps, only re-encoded from VP9 to
// H.264/mp4, nothing else changed) — if this renders where the VP9 version
// didn't, the bug is VP9/MediaTek-specific, not Skia's useVideo in general.
// Delete once the founder has seen the verdict.
const localUriFor = async (moduleId: number) => {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`expo-asset produced no localUri for module ${moduleId}`);
  }
  return asset.localUri;
};

export function ShaderMistSinglePoC() {
  const { width, height } = useWindowDimensions();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    localUriFor(require("../../assets/mist/mist_violet_h264.mp4")).then((u) => {
      if (!cancelled) setUri(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const violet = useVideo(uri, { looping: true });

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Image
        image={violet.currentFrame}
        x={0}
        y={0}
        width={width}
        height={height}
        fit="cover"
      />
    </Canvas>
  );
}
