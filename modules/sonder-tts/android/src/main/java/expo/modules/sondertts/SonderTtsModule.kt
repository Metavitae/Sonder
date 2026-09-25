package expo.modules.sondertts

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FilterInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

// Per founder decision 2026-09-25: Sonder's voice runs on the phone itself
// (Piper via sherpa-onnx), so it never depends on a paid or quota-limited
// server. Measured on the POCO (Helio G99): Piper medium voices generate
// speech ~2-3x faster than real time, so sentence-by-sentence streaming
// starts talking about a second after a reply lands.
//
// The voice model (~65 MB) isn't bundled in the APK: install() downloads it
// once and unpacks it under filesDir. After that, speaking needs no network
// at all.

// Measured 2026-09-25: 2 threads was as fast as 4 on the POCO, and leaves
// the other cores free for the UI.
private const val NUM_THREADS = 2

class SonderTtsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No React context")

  // One worker: synthesis and playback of one line at a time, in order.
  private val worker = Executors.newSingleThreadExecutor()
  // Separate from the worker so a slow download never blocks speaking.
  private val downloader = Executors.newSingleThreadExecutor()

  private var tts: OfflineTts? = null
  private var loadedVoice: String? = null

  // Bumped by every speak()/stop(); a running line checks it between
  // sentences and bails out as soon as it's been superseded (barge-in).
  @Volatile private var generation = 0
  @Volatile private var activeTrack: AudioTrack? = null

  private fun voicesRoot() = File(context.filesDir, "sonder-voices")
  private fun voiceDir(voiceId: String) = File(voicesRoot(), voiceId)
  private fun readyMarker(voiceId: String) = File(voiceDir(voiceId), ".ready")

  override fun definition() = ModuleDefinition {
    Name("SonderTts")

    Events("onInstallProgress")

    Function("isInstalled") { voiceId: String ->
      readyMarker(voiceId).exists()
    }

    AsyncFunction("install") { voiceId: String, url: String, promise: Promise ->
      downloader.execute {
        try {
          if (!readyMarker(voiceId).exists()) installVoice(voiceId, url)
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("ERR_VOICE_INSTALL", e.message ?: e.toString(), e)
        }
      }
    }

    // Loads the model ahead of time so the first spoken line doesn't pay
    // the ~2-4 s model-load cost.
    AsyncFunction("preload") { voiceId: String, modelFile: String, promise: Promise ->
      worker.execute {
        try {
          ensureLoaded(voiceId, modelFile)
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("ERR_VOICE_LOAD", e.message ?: e.toString(), e)
        }
      }
    }

    // Resolves true when the line played to the end, false when a newer
    // speak()/stop() cut it off.
    AsyncFunction("speak") { voiceId: String, modelFile: String, text: String, promise: Promise ->
      val myGeneration = ++generation
      stopActiveTrack()
      worker.execute {
        try {
          promise.resolve(speakNow(voiceId, modelFile, text, myGeneration))
        } catch (e: Exception) {
          promise.reject("ERR_VOICE_SPEAK", e.message ?: e.toString(), e)
        }
      }
    }

    Function("stop") {
      generation++
      stopActiveTrack()
    }

    OnDestroy {
      generation++
      stopActiveTrack()
      worker.execute {
        tts?.release()
        tts = null
        loadedVoice = null
      }
      worker.shutdown()
      downloader.shutdown()
    }
  }

  private fun installVoice(voiceId: String, url: String) {
    val partial = File(voicesRoot(), "$voiceId.partial")
    partial.deleteRecursively()
    partial.mkdirs()

    val connection = URL(url).openConnection() as HttpURLConnection
    connection.connectTimeout = 15_000
    connection.readTimeout = 30_000
    connection.instanceFollowRedirects = true
    try {
      if (connection.responseCode !in 200..299) {
        throw IllegalStateException("Voice download failed: HTTP ${connection.responseCode}")
      }
      val total = connection.contentLengthLong
      var lastReported = -1
      val counting = CountingInputStream(BufferedInputStream(connection.inputStream)) { read ->
        if (total > 0) {
          val percent = ((read * 100) / total).toInt()
          if (percent != lastReported) {
            lastReported = percent
            sendEvent("onInstallProgress", mapOf("voiceId" to voiceId, "fraction" to percent / 100.0))
          }
        }
      }
      TarArchiveInputStream(BZip2CompressorInputStream(counting)).use { tar ->
        val root = partial.canonicalPath + File.separator
        while (true) {
          val entry = tar.nextEntry ?: break
          // The archive wraps everything in one top-level folder
          // (e.g. vits-piper-en_US-kristin-medium/); drop it.
          val relative = entry.name.substringAfter('/', "")
          if (relative.isEmpty()) continue
          val out = File(partial, relative)
          // Never write outside the voice folder, whatever the archive says.
          if (!out.canonicalPath.startsWith(root)) continue
          if (entry.isDirectory) {
            out.mkdirs()
          } else {
            out.parentFile?.mkdirs()
            out.outputStream().use { tar.copyTo(it) }
          }
        }
      }
    } finally {
      connection.disconnect()
    }

    val finalDir = voiceDir(voiceId)
    finalDir.deleteRecursively()
    if (!partial.renameTo(finalDir)) {
      throw IllegalStateException("Couldn't move the voice into place")
    }
    readyMarker(voiceId).writeText("ok")
  }

  private fun ensureLoaded(voiceId: String, modelFile: String): OfflineTts {
    val current = tts
    if (current != null && loadedVoice == voiceId) return current
    if (!readyMarker(voiceId).exists()) {
      throw IllegalStateException("Voice $voiceId isn't installed yet")
    }
    current?.release()
    val dir = voiceDir(voiceId)
    val config = OfflineTtsConfig(
      model = OfflineTtsModelConfig(
        vits = OfflineTtsVitsModelConfig(
          model = File(dir, modelFile).absolutePath,
          tokens = File(dir, "tokens.txt").absolutePath,
          dataDir = File(dir, "espeak-ng-data").absolutePath,
        ),
        numThreads = NUM_THREADS,
        provider = "cpu",
      ),
      // One sentence per callback, so playback starts after the first
      // sentence instead of after the whole reply.
      maxNumSentences = 1,
    )
    val created = OfflineTts(config = config)
    tts = created
    loadedVoice = voiceId
    return created
  }

  private fun speakNow(voiceId: String, modelFile: String, text: String, myGeneration: Int): Boolean {
    if (myGeneration != generation) return false
    val engine = ensureLoaded(voiceId, modelFile)
    if (myGeneration != generation) return false

    val sampleRate = engine.sampleRate()
    val minBuffer = AudioTrack.getMinBufferSize(
      sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT
    )
    // ~30 s of room, so writing a sentence never has to wait for playback
    // and synthesis of the next sentence can run ahead.
    val bufferBytes = maxOf(minBuffer, sampleRate * 4 * 30)
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_MEDIA)
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()
    val track = AudioTrack.Builder()
      .setAudioAttributes(attributes)
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
          .setSampleRate(sampleRate)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build()
      )
      .setBufferSizeInBytes(bufferBytes)
      .setTransferMode(AudioTrack.MODE_STREAM)
      .build()

    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      .setAudioAttributes(attributes)
      .build()
    audioManager.requestAudioFocus(focus)

    activeTrack = track
    var framesWritten = 0L
    try {
      track.play()
      engine.generateWithCallback(text = text, sid = 0, speed = 1.0f) { samples ->
        if (myGeneration != generation) {
          0 // stop generating
        } else {
          track.write(samples, 0, samples.size, AudioTrack.WRITE_BLOCKING)
          framesWritten += samples.size
          1
        }
      }
      // Generation is done; wait for the speaker to actually finish.
      while (myGeneration == generation &&
        track.playState == AudioTrack.PLAYSTATE_PLAYING &&
        track.playbackHeadPosition.toLong() < framesWritten
      ) {
        Thread.sleep(30)
      }
      return myGeneration == generation
    } finally {
      if (activeTrack === track) activeTrack = null
      try {
        track.stop()
      } catch (_: IllegalStateException) {
      }
      track.release()
      audioManager.abandonAudioFocusRequest(focus)
    }
  }

  private fun stopActiveTrack() {
    val track = activeTrack ?: return
    try {
      track.pause()
      track.flush()
    } catch (_: IllegalStateException) {
    }
  }
}

private class CountingInputStream(
  input: InputStream,
  private val onRead: (Long) -> Unit,
) : FilterInputStream(input) {
  private var count = 0L

  override fun read(): Int {
    val b = super.read()
    if (b >= 0) onRead(++count)
    return b
  }

  override fun read(b: ByteArray, off: Int, len: Int): Int {
    val n = super.read(b, off, len)
    if (n > 0) {
      count += n
      onRead(count)
    }
    return n
  }
}
