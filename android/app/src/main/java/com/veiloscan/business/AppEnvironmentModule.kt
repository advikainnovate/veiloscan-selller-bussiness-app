package com.veiloscan.business

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class AppEnvironmentModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName() = "AppEnvironment"

  override fun getConstants(): Map<String, Any> =
    mapOf(
      "apiUrl" to BuildConfig.API_BASE_URL,
    )
}
