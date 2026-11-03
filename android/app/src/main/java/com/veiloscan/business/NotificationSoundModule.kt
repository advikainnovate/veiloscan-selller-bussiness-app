package com.veiloscan.business

import android.app.PendingIntent
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Pushes that arrive while the app is open: Android shows nothing for them,
// so the app posts the notification itself on the same channel.
class NotificationSoundModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName() = "NotificationSound"

  @ReactMethod
  fun play() {
    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION) ?: return
    RingtoneManager.getRingtone(reactApplicationContext, uri)?.play()
  }

  /**
   * Posts a notification (with the channel's sound). Tapping it opens the app
   * with veiloscan-business://push?id=…&link=…, which the JS side opens like
   * a tapped push. Falls back to just the sound when notifications are off.
   */
  @ReactMethod
  fun show(title: String, body: String, link: String?, notificationId: String?) {
    val context = reactApplicationContext
    val manager = NotificationManagerCompat.from(context)
    if (!manager.areNotificationsEnabled()) return play()

    val uri = Uri.Builder()
      .scheme("veiloscan-business")
      .authority("push")
      .apply {
        if (!notificationId.isNullOrEmpty()) appendQueryParameter("id", notificationId)
        if (!link.isNullOrEmpty()) appendQueryParameter("link", link)
      }
      .build()
    val intent = Intent(Intent.ACTION_VIEW, uri, context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val requestCode = (notificationId ?: "$title$body").hashCode()
    val tap = PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, context.getString(R.string.default_notification_channel_id))
      .setSmallIcon(R.drawable.ic_notification)
      .setColor(ContextCompat.getColor(context, R.color.notification_color))
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(tap)
      .build()
    try {
      manager.notify(requestCode, notification)
    } catch (e: SecurityException) {
      play()
    }
  }
}
