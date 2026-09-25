# The voice engine's native code calls these by name over JNI; keep them
# intact if minify is ever turned on for release builds.
-keep class com.k2fsa.sherpa.onnx.** { *; }
-keep class expo.modules.sondertts.SampleSink { *; }
