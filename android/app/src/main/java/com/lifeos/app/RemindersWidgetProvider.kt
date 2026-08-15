package com.lifeos.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * "Alright — Reminders" widget: today's pending reminders with their time.
 * Rows scale with the widget height.
 */
class RemindersWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val MAX_ROWS = 6
        private val ROW_IDS = intArrayOf(R.id.rem_row0, R.id.rem_row1, R.id.rem_row2, R.id.rem_row3, R.id.rem_row4, R.id.rem_row5)
        private val DOT_IDS = intArrayOf(R.id.rem_row0_dot, R.id.rem_row1_dot, R.id.rem_row2_dot, R.id.rem_row3_dot, R.id.rem_row4_dot, R.id.rem_row5_dot)
        private val TIME_IDS = intArrayOf(R.id.rem_row0_time, R.id.rem_row1_time, R.id.rem_row2_time, R.id.rem_row3_time, R.id.rem_row4_time, R.id.rem_row5_time)
        private val TITLE_IDS = intArrayOf(R.id.rem_row0_title, R.id.rem_row1_title, R.id.rem_row2_title, R.id.rem_row3_title, R.id.rem_row4_title, R.id.rem_row5_title)

        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = try {
                buildViews(context, widgetId)
            } catch (e: Exception) {
                // Never let the widget render blank because of a render error.
                RemoteViews(context.packageName, R.layout.reminders_widget)
            }
            manager.updateAppWidget(widgetId, views)
        }

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.reminders_widget)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(
                    context, 0, Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            )
            views.setTextViewText(R.id.widget_date, java.text.SimpleDateFormat("EEE d MMM", java.util.Locale.getDefault()).format(java.util.Calendar.getInstance().time))

            val doc = WidgetData.readDocument(context)
            val today = WidgetData.todayKey()
            val items = doc?.let { reminderItems(it, today) }.orEmpty()
            val rowCount = WidgetData.rowLimit(context, widgetId, MAX_ROWS)

            for (i in 0 until MAX_ROWS) {
                val visible = i < rowCount && i < items.size
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
                if (doc == null) "Open Alright to add reminders" else "No reminders today"
            )
            return views
        }

        private data class ReminderItem(val title: String, val time: String, val color: Int)

        private fun reminderItems(doc: JSONObject, today: String): List<ReminderItem> {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections") ?: return emptyList()
            val reminders = collections.optJSONArray("reminders") ?: return emptyList()
            val out = mutableListOf<ReminderItem>()
            for (i in 0 until reminders.length()) {
                val r = reminders.optJSONObject(i) ?: continue
                if (WidgetData.isDeleted(r)) continue
                if (r.optString("status") == "dismissed") continue
                val remindAt = r.optString("remindAt")
                if (remindAt.isBlank() || remindAt.take(10) != today) continue
                out.add(ReminderItem(r.optString("title"), WidgetData.hhmm(remindAt), WidgetData.parseColor(r.optString("color"))))
            }
            out.sortBy { it.time }
            return out
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) updateWidget(context, appWidgetManager, id)
    }

    override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle?) {
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action != WidgetData.ACTION_REFRESH) return
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(android.content.ComponentName(context, RemindersWidgetProvider::class.java))
        for (id in ids) updateWidget(context, manager, id)
    }
}
