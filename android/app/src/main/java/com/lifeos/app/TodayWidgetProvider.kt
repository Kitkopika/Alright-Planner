package com.lifeos.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Home-screen widget: "Alright — Today".
 *
 * Reads the app's local-first data file (personal-data.json, the same file the
 * app persists to via expo-file-system) and shows today's events + tasks, up to
 * 5 rows, with the event/task color as an accent bar. Tapping the widget opens
 * the app. Refreshes on placement, periodically, and every time the app is
 * opened (MainActivity.onResume).
 *
 * Recurring tasks/events are not expanded here (v1) — only entries whose date
 * literally falls on today are shown.
 */
class TodayWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_REFRESH = "com.lifeos.app.action.REFRESH_WIDGET"
        private const val MAX_ROWS = 5
        private const val DATA_FILE = "personal-data.json"
        private const val BACKUP_FILE = "personal-data.backup.json"
        private const val DEFAULT_COLOR = "#4F46E5"

        private val ROW_IDS = intArrayOf(R.id.row0, R.id.row1, R.id.row2, R.id.row3, R.id.row4)
        private val DOT_IDS = intArrayOf(R.id.row0_dot, R.id.row1_dot, R.id.row2_dot, R.id.row3_dot, R.id.row4_dot)
        private val TIME_IDS = intArrayOf(R.id.row0_time, R.id.row1_time, R.id.row2_time, R.id.row3_time, R.id.row4_time)
        private val TITLE_IDS = intArrayOf(R.id.row0_title, R.id.row1_title, R.id.row2_title, R.id.row3_title, R.id.row4_title)

        /** Refreshes a single widget (used by onUpdate, onReceive and MainActivity). */
        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            manager.updateAppWidget(widgetId, buildViews(context))
        }

        private fun buildViews(context: Context): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.today_widget)

            // Tap anywhere on the widget → open the app.
            val open = PendingIntent.getActivity(
                context, 0, Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, open)

            val cal = Calendar.getInstance()
            val today = dateKey(cal)
            views.setTextViewText(R.id.widget_date, SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(cal.time))

            val doc = readDocument(context)
            val items = doc?.let { todayItems(it, today) }.orEmpty()
            renderRows(views, items, hasData = doc != null)
            return views
        }

        private fun renderRows(views: RemoteViews, items: List<WidgetItem>, hasData: Boolean) {
            for (i in 0 until MAX_ROWS) {
                val visible = i < items.size
                views.setViewVisibility(ROW_IDS[i], if (visible) View.VISIBLE else View.GONE)
                if (visible) {
                    val item = items[i]
                    views.setInt(DOT_IDS[i], "setBackgroundColor", item.color)
                    views.setTextViewText(TIME_IDS[i], item.time)
                    views.setTextViewText(TITLE_IDS[i], item.title)
                }
            }
            views.setViewVisibility(R.id.widget_empty, if (items.isEmpty()) View.VISIBLE else View.GONE)
            views.setTextViewText(
                R.id.widget_empty,
                if (hasData) "Nothing scheduled today" else "Open Alright to plan your day"
            )
        }

        private fun todayItems(doc: JSONObject, today: String): List<WidgetItem> {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections")
                ?: return emptyList()
            val out = mutableListOf<WidgetItem>()

            // Events covering today (multi-day included).
            val events = collections.optJSONArray("events")
            if (events != null) {
                for (i in 0 until events.length()) {
                    val ev = events.optJSONObject(i) ?: continue
                    if (ev.has("deletedAt") && !ev.isNull("deletedAt")) continue
                    val startAt = ev.optString("startAt")
                    if (startAt.isBlank()) continue
                    val startDay = startAt.take(10)
                    val endDay = ev.optString("endAt").take(10).ifBlank { startDay }
                    if (today < startDay || today > endDay) continue
                    val allDay = ev.optBoolean("allDay", false)
                    val time = if (allDay) "" else hhmm(startAt)
                    out.add(WidgetItem(ev.optString("title"), time, parseColor(ev.optString("color")), startAt))
                }
            }

            // Tasks due today (non-recurring).
            val tasks = collections.optJSONArray("tasks")
            if (tasks != null) {
                for (i in 0 until tasks.length()) {
                    val task = tasks.optJSONObject(i) ?: continue
                    if (task.has("deletedAt") && !task.isNull("deletedAt")) continue
                    val status = task.optString("status")
                    if (status == "done" || status == "cancelled") continue
                    val dueAt = task.optString("dueAt")
                    if (dueAt.isBlank() || dueAt.take(10) != today) continue
                    val time = if (dueAt.length >= 16) hhmm(dueAt) else ""
                    out.add(WidgetItem(task.optString("title"), time, parseColor(task.optString("color")), dueAt))
                }
            }

            // No-time (all-day / date-only) items first, then by time.
            out.sortWith(compareBy<WidgetItem> { if (it.time.isEmpty()) 0 else 1 }.thenBy { it.sortKey })
            return out.take(MAX_ROWS)
        }

        private fun hhmm(iso: String): String = iso.take(16).takeLast(5)

        private fun parseColor(hex: String): Int =
            try {
                if (hex.isBlank()) Color.parseColor(DEFAULT_COLOR) else Color.parseColor(hex)
            } catch (_: Exception) {
                Color.parseColor(DEFAULT_COLOR)
            }

        private fun dateKey(cal: Calendar): String =
            String.format(
                Locale.US, "%04d-%02d-%02d",
                cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)
            )

        /** Reads the app data file (falling back to the rotating backup). */
        private fun readDocument(context: Context): JSONObject? {
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
    }

    private data class WidgetItem(val title: String, val time: String, val color: Int, val sortKey: String)

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        // super.onReceive already dispatched APPWIDGET_UPDATE → onUpdate; this
        // branch handles the explicit in-app refresh action.
        if (intent.action != ACTION_REFRESH) return
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
        for (id in ids) updateWidget(context, manager, id)
    }
}
