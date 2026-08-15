package com.lifeos.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/**
 * Native bridge so the JS side can refresh the home-screen widgets right after
 * saving data — no need to leave/reopen the app.
 */
class WidgetUpdaterModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetUpdater"

    @ReactMethod
    fun refreshWidgets() {
        try {
            WidgetData.refreshAll(reactContext)
        } catch (_: Exception) {
            // never crash the app because of a widget refresh
        }
    }
}

class WidgetUpdaterPackage : com.facebook.react.ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<ReactContextBaseJavaModule> =
        listOf(WidgetUpdaterModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
