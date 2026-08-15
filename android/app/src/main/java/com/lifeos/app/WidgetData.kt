package com.lifeos.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.graphics.Color
import org.json.JSONObject
import java.io.File
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale

/**
 * Shared helpers for the "Alright" home-screen widgets: reads the app's
 * local-first data file, formats values, and refreshes every widget type.
 */
object WidgetData {

    const val ACTION_REFRESH = "com.lifeos.app.action.REFRESH_WIDGET"
    const val DATA_FILE = "personal-data.json"
    const val BACKUP_FILE = "personal-data.backup.json"
    const val SETTINGS_FILE = "settings.json"
    const val DEFAULT_COLOR = "#4F46E5"

    /** Reads the app data file, falling back to the rotating backup. */
    fun readDocument(context: Context): JSONObject? {
        val dir = context.filesDir
        for (name in listOf(DATA_FILE, BACKUP_FILE)) {
            val f = File(dir, name)
            if (f.exists()) {
                try {
                    val text = f.readText()
                    if (text.isNotBlank()) return JSONObject(text)
                } catch (_: Exception) {
                    // corrupt / unreadable — try the next candidate
                }
            }
        }
        return null
    }

    /** Currency from the app settings file ("THB" default). */
    fun readCurrency(context: Context): String {
        try {
            val f = File(context.filesDir, SETTINGS_FILE)
            if (f.exists()) {
                val s = JSONObject(f.readText())
                val c = s.optString("currency")
                if (c.isNotBlank()) return c
            }
        } catch (_: Exception) {
        }
        return "THB"
    }

    /** True when an entity is soft-deleted (deletedAt set). */
    fun isDeleted(obj: JSONObject): Boolean = obj.has("deletedAt") && !obj.isNull("deletedAt")

    /** "YYYY-MM-DD" for today (local time). */
    fun todayKey(): String {
        val cal = Calendar.getInstance()
        return String.format(
            Locale.US, "%04d-%02d-%02d",
            cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)
        )
    }

    /** "HH:mm" from an ISO datetime, or "" when it has no time part. */
    fun hhmm(iso: String): String = if (iso.length >= 16) iso.take(16).takeLast(5) else ""

    fun parseColor(hex: String): Int =
        try {
            if (hex.isBlank()) Color.parseColor(DEFAULT_COLOR) else Color.parseColor(hex)
        } catch (_: Exception) {
            Color.parseColor(DEFAULT_COLOR)
        }

    /** Money from integer minor units, e.g. 123456 -> "฿1,234.56" / "$1,234.56". */
    fun formatMoney(cents: Long, currency: String): String {
        val amount = cents / 100.0
        val formatted = NumberFormat.getNumberInstance(Locale.US).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }.format(amount)
        return if (currency.equals("USD", true)) "$$formatted" else "฿$formatted"
    }

    /**
     * How many list rows a widget should render, based on how tall the user
     * resized it (from the widget options). Makes widgets scale with their size.
     */
    fun rowLimit(context: Context, widgetId: Int, max: Int): Int {
        val h = try {
            AppWidgetManager.getInstance(context)
                .getAppWidgetOptions(widgetId)
                .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
        } catch (_: Exception) {
            110
        }
        return when {
            h >= 300 -> max
            h >= 200 -> minOf(max, 6)
            h >= 140 -> minOf(max, 4)
            else -> minOf(max, 3)
        }
    }

    /** Refreshes every placed widget of every type. */
    fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val providers = arrayOf(
            TodayWidgetProvider::class.java,
            MoneyWidgetProvider::class.java,
            HabitsWidgetProvider::class.java,
            FocusWidgetProvider::class.java,
        )
        for (provider in providers) {
            val ids = manager.getAppWidgetIds(ComponentName(context, provider))
            for (id in ids) {
                when (provider) {
                    TodayWidgetProvider::class.java -> TodayWidgetProvider.updateWidget(context, manager, id)
                    MoneyWidgetProvider::class.java -> MoneyWidgetProvider.updateWidget(context, manager, id)
                    HabitsWidgetProvider::class.java -> HabitsWidgetProvider.updateWidget(context, manager, id)
                    FocusWidgetProvider::class.java -> FocusWidgetProvider.updateWidget(context, manager, id)
                }
            }
        }
    }
}
