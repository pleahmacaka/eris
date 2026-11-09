package app.eris.files

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaScannerConnection
import android.media.ThumbnailUtils
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.Settings
import android.util.Size
import android.webkit.MimeTypeMap
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.util.concurrent.Executors

@InvokeArg
class PathArgs {
  lateinit var path: String
}

@InvokeArg
class KeepAliveArgs {
  var enabled: Boolean = false
}

@InvokeArg
class ThumbArgs {
  lateinit var path: String
  var size: Int = 160
}

@InvokeArg
class PathsArgs {
  lateinit var paths: List<String>
}

@TauriPlugin
class FilesPlugin(private val activity: Activity) : Plugin(activity) {
  override fun load(webView: WebView) {
    if (!granted()) {
      ask()
    }
  }

  private val thumbs = Executors.newFixedThreadPool(3)

  private val videos = setOf("mp4", "mkv", "mov", "webm", "3gp", "avi", "m4v")

  private fun decode(source: File, size: Int): Bitmap? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val bounds = Size(size, size)

      return if (source.extension.lowercase() in videos) {
        ThumbnailUtils.createVideoThumbnail(source, bounds, null)
      } else {
        ThumbnailUtils.createImageThumbnail(source, bounds, null)
      }
    }

    val probe = BitmapFactory.Options().apply { inJustDecodeBounds = true }

    BitmapFactory.decodeFile(source.path, probe)

    val scale = maxOf(1, minOf(probe.outWidth, probe.outHeight) / size)

    return BitmapFactory.decodeFile(source.path, BitmapFactory.Options().apply { inSampleSize = Integer.highestOneBit(scale) })
  }

  private val legacy = arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE)

  private fun granted(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Environment.isExternalStorageManager()
    } else {
      legacy.all { activity.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
    }

  private fun ask() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      activity.requestPermissions(legacy, 0)

      return
    }

    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${activity.packageName}"))

    runCatching { activity.startActivity(intent) }
      .onFailure { activity.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)) }
  }

  private fun uri(path: String): Uri =
    FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", File(path))

  private fun mime(path: String): String =
    MimeTypeMap.getSingleton().getMimeTypeFromExtension(File(path).extension.lowercase()) ?: "*/*"

  @Command
  fun storageAccess(invoke: Invoke) {
    invoke.resolve(JSObject().put("granted", granted()))
  }

  @Command
  fun requestStorage(invoke: Invoke) {
    ask()
    invoke.resolve()
  }

  @Command
  fun openFile(invoke: Invoke) {
    val path = invoke.parseArgs(PathArgs::class.java).path

    try {
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri(path), mime(path))
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

      activity.startActivity(intent)
      invoke.resolve()
    } catch (error: ActivityNotFoundException) {
      invoke.reject("noApp")
    } catch (error: IllegalArgumentException) {
      invoke.reject("unsupported")
    }
  }

  @Command
  fun openWith(invoke: Invoke) {
    val path = invoke.parseArgs(PathArgs::class.java).path

    try {
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri(path), mime(path))
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

      activity.startActivity(Intent.createChooser(intent, null))
      invoke.resolve()
    } catch (error: IllegalArgumentException) {
      invoke.reject("unsupported")
    }
  }

  @Command
  fun shareFiles(invoke: Invoke) {
    val paths = invoke.parseArgs(PathsArgs::class.java).paths

    try {
      val uris = ArrayList(paths.map(::uri))
      val intent = if (uris.size == 1) {
        Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris[0]).setType(mime(paths[0]))
      } else {
        Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris).setType("*/*")
      }

      activity.startActivity(Intent.createChooser(intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), null))
      invoke.resolve()
    } catch (error: IllegalArgumentException) {
      invoke.reject("unsupported")
    }
  }

  @Command
  fun keepAlive(invoke: Invoke) {
    val enabled = invoke.parseArgs(KeepAliveArgs::class.java).enabled
    val service = Intent(activity, NodeService::class.java)

    if (!enabled) {
      activity.stopService(service)
      invoke.resolve()

      return
    }

    val asking = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

    if (asking) {
      activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 0)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      activity.startForegroundService(service)
    } else {
      activity.startService(service)
    }

    invoke.resolve()
  }

  @Command
  fun sendToBack(invoke: Invoke) {
    activity.moveTaskToBack(true)
    invoke.resolve()
  }

  @Command
  fun thumbnail(invoke: Invoke) {
    val args = invoke.parseArgs(ThumbArgs::class.java)

    thumbs.execute {
      try {
        val source = File(args.path)
        val folder = File(activity.cacheDir, "thumbs").apply { mkdirs() }
        val target = File(folder, "${source.absolutePath.hashCode()}-${source.lastModified()}-${args.size}.jpg")

        if (!target.exists()) {
          val bitmap = decode(source, args.size) ?: throw IllegalStateException("unsupported")

          target.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 80, it) }
          bitmap.recycle()
        }

        invoke.resolve(JSObject().put("path", target.absolutePath))
      } catch (error: Exception) {
        invoke.reject("unsupported")
      }
    }
  }

  @Command
  fun storageStats(invoke: Invoke) {
    val path = invoke.parseArgs(PathArgs::class.java).path

    try {
      val stats = StatFs(path)

      invoke.resolve(JSObject().put("total", stats.totalBytes).put("free", stats.availableBytes))
    } catch (error: IllegalArgumentException) {
      invoke.reject("missing")
    }
  }

  @Command
  fun scanFiles(invoke: Invoke) {
    val paths = invoke.parseArgs(PathsArgs::class.java).paths

    MediaScannerConnection.scanFile(activity, paths.toTypedArray(), null, null)
    invoke.resolve()
  }
}
