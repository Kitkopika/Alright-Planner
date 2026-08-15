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
 * "Alright — Today" widget: today's tasks + events with a done-progress
 * summary. Rows scale with the widget height. Tapping opens the app.
 */
class TodayWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val MAX_ROWS = 6
        private val ROW_IDS = intArrayOf(R.id.today_row0, R.id.today_row1, R.id.today_row2, R.id.today_row3, R.id.today_row4, R.id.today_row5)
        private val DOT_IDS = intArrayOf(R.id.today_row0_dot, R.id.today_row1_dot, R.id.today_row2_dot, R.id.today_row3_dot, R.id.today_row4_dot, R.id.today_row5_dot)
        private val TIME_IDS = intArrayOf(R.id.today_row0_time, R.id.today_row1_time, R.id.today_row2_time, R.id.today_row3_time, R.id.today_row4_time, R.id.today_row5_time)
        private val TITLE_IDS = intArrayOf(R.id.today_row0_title, R.id.today_row1_title, R.id.today_row2_title, R.id.today_row3_title, R.id.today_row4_title, R.id.today_row5_title)

        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = try {
                buildViews(context, widgetId)
            } catch (e: Exception) {
                // Never let the widget render blank because of a render error.
                RemoteViews(context.packageName, R.layout.today_widget)
            }
            manager.updateAppWidget(widgetId, views)
        }

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.today_widget)
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
            val items = doc?.let { todayItems(it, today) }.orEmpty()
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
                if (doc == null) "Open Alright to plan your day" else "Nothing scheduled today"
            )

            // Progress summary, e.g. "2/5 tasks done".
            if (doc != null) {
                val counts = taskCounts(doc, today)
                views.setTextViewText(
                    R.id.widget_summary,
                    if (counts.first == 0) "No tasks due today" else "${counts.second}/${counts.first} tasks done"
                )
            } else {
                views.setTextViewText(R.id.widget_summary, "")
            }
            views.setViewVisibility(R.id.widget_summary, if (doc != null) View.VISIBLE else View.GONE)

            return views
        }

        private data class TodayItem(val title: String, val time: String, val color: Int, val sortKey: String)

        private fun todayItems(doc: JSONObject, today: String): List<TodayItem> {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections") ?: return emptyList()
            val out = mutableListOf<TodayItem>()

            val events = collections.optJSONArray("events")
            if (events != null) {
                for (i in 0 until events.length()) {
                    val ev = events.optJSONObject(i) ?: continue
                    if (WidgetData.isDeleted(ev)) continue
                    val startAt = ev.optString("startAt")
                    if (startAt.isBlank()) continue
                    val startDay = startAt.take(10)
                    val endDay = ev.optString("endAt").take(10).ifBlank { startDay }
                    if (today < startDay || today > endDay) continue
                    val time = if (ev.optBoolean("allDay", false)) "" else WidgetData.hhmm(startAt)
                    out.add(TodayItem(ev.optString("title"), time, WidgetData.parseColor(ev.optString("color")), startAt))
                }
            }

            val tasks = collections.optJSONArray("tasks")
            if (tasks != null) {
                for (i in 0 until tasks.length()) {
                    val task = tasks.optJSONObject(i) ?: continue
                    if (WidgetData.isDeleted(task)) continue
                    val status = task.optString("status")
                    if (status == "done" || status == "cancelled") continue
                    val dueAt = task.optString("dueAt")
                    if (dueAt.isBlank() || dueAt.take(10) != today) continue
                    out.add(TodayItem(task.optString("title"), WidgetData.hhmm(dueAt), WidgetData.parseColor(task.optString("color")), dueAt))
                }
            }

            out.sortWith(compareBy<TodayItem> { if (it.time.isEmpty()) 0 else 1 }.thenBy { it.sortKey })
            return out
        }

        /** Pair(total due today, done today). */
        private fun taskCounts(doc: JSONObject, today: String): Pair<Int, Int> {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections") ?: return 0 to 0
            val tasks = collections.optJSONArray("tasks") ?: return 0 to 0
            var total = 0
            var done = 0
            for (i in 0 until tasks.length()) {
                val task = tasks.optJSONObject(i) ?: continue
                if (WidgetData.isDeleted(task)) continue
                if (task.optString("status") == "cancelled") continue
                val dueAt = task.optString("dueAt")
                if (dueAt.isBlank() || dueAt.take(10) != today) continue
                total++
                if (task.optString("status") == "done") done++
            }
            return total to done
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
        val ids = manager.getAppWidgetIds(android.content.ComponentName(context, TodayWidgetProvider::class.java))
        for (id in ids) updateWidget(context, manager, id)
    }
}
