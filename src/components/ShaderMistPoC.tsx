import { Canvas, Image } from "@shopify/react-native-skia";
import { useWindowDimensions } from "react-native";
import { useEffect, useState } from "react";
import { Asset } from "expo-asset";
import { useVideo } from "@shopify/react-native-skia/lib/module/external/reanimated";

// react-native's require() for a video asset resolves to a numeric module
// ID, not a URI string — expo-video's useVideoPlayer auto-resolves that
// internally, but Skia's useVideo takes a plain string and doesn't.
//
// First attempt used RNImage.resolveAssetSource(moduleId).uri, which crashed
// twice (2026-08-09): first with a native abort on the raw require() (fixed
// by resolving it), then again on the *resolved* URI itself with a vague
// "Unable to get exception message" abort. Root cause, found by reading
// Skia's Android native source (RNSkVideo.java): it hands the string
// straight to MediaExtractor.setDataSource(context, uri, ...), which only
// understands real Android URI schemes (file://, content://,
// android.resource://, http(s)://) — not React Native's own packaged-asset
// "asset:///..." scheme that resolveAssetSource returns in a release APK.
// expo-asset's downloadAsync() actually copies the bundled asset out to a
// real file:// path on first use (then caches it), which MediaExtractor can
// open — that's the fix, not another resolveAssetSource variant.
const localUriFor = async (moduleId: number) => {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`expo-asset produced no localUri for module ${moduleId}`);
  }
  return asset.localUri;
};

// TEMPORARY, evaluation-only: "Sonder - Shader-Based Mixing: Proof-of-Concept
// Only (canonical 2026-08-09)". Responds to CC's Part 11 finding that the
// mist's real bottleneck is SurfaceFlinger compositing N independent
// SurfaceView-backed video layers per frame, not decode throughput (which
// the Part 11 lighter encode already fixed). This renders the SAME real mist
// video assets (not placeholder shapes) as GPU texture layers inside ONE
// Skia canvas/surface, blended with a real GPU blend mode (Plus — additive,
// matches "colors mix as primaries" from the original 5-layer design) —
// testing whether a single-surface approach removes the N-surface
// compositing cost, independent of whatever decode path Skia's video
// pipeline uses internally. Representative 3-color subset (violet/cyan/
// amber), matching the same subset MistThreeLayerTest.tsx used, so the
// logcat comparison between the two approaches is apples-to-apples. Not
// wired into the real face-tracking screen yet, no opacity-mixing
// interface, no mood-mapping — evaluation only, per canonical scope. Delete
// or promote once the founder has seen it and a direction is decided.
//
// Using the *_h264.mp4 sources, not the original *.webm/VP9 ones (2026-08-10):
// isolated testing (shader-test.tsx, shader-test-single.tsx) proved this
// device's MediaTek hardware VP9 decoder (c2.mtk.vp9.decoder) doesn't work
// with Skia's HardwareBuffer/ImageReader video output path at all — every
// VP9 test showed Render:0 no matter what. Re-encoding to H.264 (same
// 180x320/10fps, only the codec changed) confirmed real rendering. This
// was never a bug in the shader-mixing architecture itself.
export function ShaderMistPoC() {
  const { width, height } = useWindowDimensions();
  const [uris, setUris] = useState<{
    violet: string | null;
    cyan: string | null;
    amber: string | null;
  }>({ violet: null, cyan: null, amber: null });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      localUriFor(require("../../assets/mist/mist_violet_h264.mp4")),
      localUriFor(require("../../assets/mist/mist_cyan_h264.mp4")),
      localUriFor(require("../../assets/mist/mist_amber_h264.mp4")),
    ]).then(([violet, cyan, amber]) => {
      if (!cancelled) setUris({ violet, cyan, amber });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const violet = useVideo(uris.violet, { looping: true });
  const cyan = useVideo(uris.cyan, { looping: true });
  const amber = useVideo(uris.amber, { looping: true });

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
      <Image
        image={cyan.currentFrame}
        x={0}
        y={0}
        width={width}
        height={height}
        fit="cover"
        blendMode="plus"
      />
      <Image
        image={amber.currentFrame}
        x={0}
        y={0}
        width={width}
        height={height}
        fit="cover"
        blendMode="plus"
      />
    </Canvas>
  );
}
