const path = require("path");
const fs = require("fs");
const { withDangerousMod, withXcodeProject, IOSConfig } = require("@expo/config-plugins");

/**
 * react-native-mediapipe ships no Expo config plugin of its own (unlike its
 * sibling react-native-mediapipe-posedetection). This ports that sibling
 * plugin's asset-copy behavior for the .task model file: Android gets the
 * file copied into android/app/src/main/assets/, iOS gets it copied to the
 * ios/ project root with an Xcode resource reference.
 */
function withAndroidAssets(config, { assetsPaths = [] }) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const { projectRoot } = cfg.modRequest;
      const assetsDir = path.join(projectRoot, "android", "app", "src", "main", "assets");
      fs.mkdirSync(assetsDir, { recursive: true });
      for (const assetSourceDir of assetsPaths) {
        const assetSourcePath = path.join(projectRoot, assetSourceDir);
        let files;
        try {
          files = fs.readdirSync(assetSourcePath, { withFileTypes: true });
        } catch {
          console.warn(`[withMediapipeFaceLandmark][Android] Could not read directory: ${assetSourcePath}`);
          continue;
        }
        for (const file of files) {
          if (file.isFile()) {
            fs.copyFileSync(path.join(assetSourcePath, file.name), path.join(assetsDir, file.name));
          }
        }
      }
      return cfg;
    },
  ]);
}

function withIosAssets(config, { assetsPaths = [] }) {
  return withXcodeProject(config, async (cfg) => {
    const { projectRoot, platformProjectRoot } = cfg.modRequest;
    const project = cfg.modResults;
    const projectName = cfg.modRequest.projectName || "App";
    fs.mkdirSync(platformProjectRoot, { recursive: true });
    for (const assetSourceDir of assetsPaths) {
      const assetSourcePath = path.join(projectRoot, assetSourceDir);
      let files;
      try {
        files = fs.readdirSync(assetSourcePath, { withFileTypes: true });
      } catch {
        console.warn(`[withMediapipeFaceLandmark][iOS] Could not read directory: ${assetSourcePath}`);
        continue;
      }
      for (const file of files) {
        if (file.isFile()) {
          fs.copyFileSync(path.join(assetSourcePath, file.name), path.join(platformProjectRoot, file.name));
          IOSConfig.XcodeUtils.addResourceFileToGroup({
            filepath: file.name,
            groupName: projectName,
            project,
            isBuildFile: true,
          });
        }
      }
    }
    return cfg;
  });
}

module.exports = function withMediapipeFaceLandmark(config, props = {}) {
  config = withAndroidAssets(config, props);
  config = withIosAssets(config, props);
  return config;
};
