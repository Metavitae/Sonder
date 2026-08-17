package expo.modules.sonderaudioroute

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Per "Sonder - Direct Instructions for CC 2026-08-14 Part 22/25", item 4 —
// real audio-route detection. Confirmed during Part 22's research: neither
// expo-av (deprecated, removed SDK55) nor expo-audio expose a headphone
// connect/disconnect event, only "audio auto-stops on disconnect." A local
// Expo Module gets the real event: android.media.AudioManager's
// AudioDeviceCallback (API 23+, well within this project's minSdkVersion
// 26) fires whenever an output device is added/removed, which covers both
// the wired jack and Bluetooth (A2DP/SCO/BLE) cases item 4 asked for in one
// mechanism, no separate BroadcastReceiver needed.
private val HEADSET_TYPES = setOf(
  AudioDeviceInfo.TYPE_WIRED_HEADSET,
  AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
  AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
  AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
  AudioDeviceInfo.TYPE_BLE_HEADSET,
)

class SonderAudioRouteModule : Module() {
  private var callback: AudioDeviceCallback? = null

  private val audioManager: AudioManager?
    get() = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  private fun isHeadsetConnected(): Boolean {
    val devices = audioManager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS) ?: return false
    return devices.any { it.type in HEADSET_TYPES }
  }

  override fun definition() = ModuleDefinition {
    Name("SonderAudioRoute")

    Events("onAudioRouteChanged")

    Function("isHeadsetConnected") {
      isHeadsetConnected()
    }

    // Registered/unregistered against the module's own lifecycle (not a
    // React component's) so the route is tracked app-wide, matching how
    // FreefallStartle mounts once in the root layout rather than per-screen.
    OnCreate {
      val manager = audioManager ?: return@OnCreate
      val cb = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) {
          if (addedDevices.any { it.type in HEADSET_TYPES }) {
            sendEvent("onAudioRouteChanged", mapOf("connected" to true))
          }
        }

        override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
          // Re-derive from the full device list rather than assuming
          // "removed" means "disconnected" — a phone can have more than
          // one headset-type device registered (e.g. wired + BT both
          // paired), so losing one doesn't necessarily mean losing all.
          sendEvent("onAudioRouteChanged", mapOf("connected" to isHeadsetConnected()))
        }
      }
      callback = cb
      manager.registerAudioDeviceCallback(cb, null)
    }

    OnDestroy {
      callback?.let { audioManager?.unregisterAudioDeviceCallback(it) }
      callback = null
    }
  }
}
