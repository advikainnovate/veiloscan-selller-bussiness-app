package com.veiloscan.business

import android.media.RingtoneManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationSoundModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName() = "NotificationSound"

  @ReactMethod
  fun play() {
    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION) ?: return
    RingtoneManager.getRingtone(reactApplicationContext, uri)?.play()
  }
}
