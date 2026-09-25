const { withAppBuildGradle, withGradleProperties } = require("@expo/config-plugins");

/**
 * Ship native code only for real phone CPUs (64-bit and 32-bit ARM).
 *
 * Found 2026-09-25: the on-device voice engine (sherpa-onnx, via
 * modules/sonder-tts) carries ~25 MB of native libraries per CPU type, and
 * packing all four types (including x86/x86_64, which only emulators use)
 * ran the CI build out of memory at :app:packageRelease. Dropping the
 * emulator types keeps the APK smaller for users too.
 */
const PHONE_ABIS = ["arm64-v8a", "armeabi-v7a"];

function withPhoneAbisOnly(config) {
  config = withGradleProperties(config, (cfg) => {
    const setProp = (key, value) => {
      cfg.modResults = cfg.modResults.filter((p) => !(p.type === "property" && p.key === key));
      cfg.modResults.push({ type: "property", key, value });
    };
    setProp("reactNativeArchitectures", PHONE_ABIS.join(","));
    // Packing the APK needs more than the template's 2 GB heap now.
    setProp("org.gradle.jvmargs", "-Xmx6g -XX:MaxMetaspaceSize=1g");
    return cfg;
  });

  return withAppBuildGradle(config, (cfg) => {
    const marker = "// withPhoneAbisOnly";
    if (!cfg.modResults.contents.includes(marker)) {
      const filters = PHONE_ABIS.map((a) => `"${a}"`).join(", ");
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /defaultConfig\s*\{/,
        (m) => `${m}\n        ${marker}\n        ndk { abiFilters ${filters} }`
      );
    }
    return cfg;
  });
}

module.exports = withPhoneAbisOnly;
