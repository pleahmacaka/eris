package app.eris.files

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

class NodeService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val manager = getSystemService(NotificationManager::class.java)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL, getString(R.string.eris_node_channel), NotificationManager.IMPORTANCE_MIN),
      )
    }

    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val open = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL) else Notification.Builder(this)

    val notification = builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(getString(R.string.eris_node_title))
      .setContentText(getString(R.string.eris_node_text))
      .setContentIntent(open)
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(ID, notification)
    }

    return START_NOT_STICKY
  }

  companion object {
    const val CHANNEL = "eris-node"
    const val ID = 7301
  }
}
