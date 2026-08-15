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
 * "Alright — Focus" widget: today's total focus time + session count, plus the
 * latest sessions. Rows scale with the widget height.
 */
class FocusWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val MAX_ROWS = 4
        private val ROW_IDS = intArrayOf(R.id.focus_row0, R.id.focus_row1, R.id.focus_row2, R.id.focus_row3)
        private val TITLE_IDS = intArrayOf(R.id.focus_row0_title, R.id.focus_row1_title, R.id.focus_row2_title, R.id.focus_row3_title)
        private val MIN_IDS = intArrayOf(R.id.focus_row0_min, R.id.focus_row1_min, R.id.focus_row2_min, R.id.focus_row3_min)

        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = try {
                buildViews(context, widgetId)
            } catch (e: Exception) {
                // Never let the widget render blank because of a render error.
                RemoteViews(context.packageName, R.layout.focus_widget)
            }
            manager.updateAppWidget(widgetId, views)
        }

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.focus_widget)
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
            val data = doc?.let { focusData(it, today) }

            if (data != null) {
                views.setTextViewText(R.id.focus_total, "${data.totalMin} min · ${data.count} sessions")
                val rowCount = WidgetData.rowLimit(context, widgetId, MAX_ROWS)
                for (i in 0 until MAX_ROWS) {
                    val visible = i < rowCount && i < data.recent.size
                    views.setViewVisibility(ROW_IDS[i], if (visible) View.VISIBLE else View.GONE)
                    if (visible) {
                        val s = data.recent[i]
                        views.setTextViewText(TITLE_IDS[i], s.title)
                        views.setTextViewText(MIN_IDS[i], "${s.min} min")
                    }
                }
                views.setViewVisibility(R.id.widget_empty, if (data.count == 0) View.VISIBLE else View.GONE)
                views.setTextViewText(R.id.widget_empty, if (data.count == 0) "No focus sessions today" else "")
            } else {
                views.setTextViewText(R.id.focus_total, "0 min · 0 sessions")
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                views.setTextViewText(R.id.widget_empty, "Open Alright to start focusing")
                for (id in ROW_IDS) views.setViewVisibility(id, View.GONE)
            }
            return views
        }

        private data class Session(val title: String, val min: Int)
        private data class FocusData(val totalMin: Int, val count: Int, val recent: List<Session>)

        private fun focusData(doc: JSONObject, today: String): FocusData {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections") ?: return FocusData(0, 0, emptyList())
            val sessions = collections.optJSONArray("focusSessions") ?: return FocusData(0, 0, emptyList())
            val list = mutableListOf<JSONObject>()
            for (i in 0 until sessions.length()) {
                val s = sessions.optJSONObject(i) ?: continue
                if (!WidgetData.isDeleted(s) && s.optString("startedAt").take(10) == today) list.add(s)
            }
            list.sortByDescending { it.optString("startedAt") }
            val total = list.sumOf { it.optInt("durationMin", 0) }
            val recent = list.take(4).map { s ->
                val subject = s.optString("subject")
                val taskId = s.optString("taskId")
                val title = subject.ifBlank { taskTitle(collections, taskId).ifBlank { "Focus" } }
                Session(title, s.optInt("durationMin", 0))
            }
            return FocusData(total, list.size, recent)
        }

        private fun taskTitle(collections: JSONObject, taskId: String): String {
            if (taskId.isBlank()) return ""
            collections.optJSONArray("tasks")?.let { tasks ->
                for (i in 0 until tasks.length()) {
                    val t = tasks.optJSONObject(i) ?: continue
                    if (t.optString("id") == taskId) return t.optString("title")
                }
            }
            return ""
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
        val ids = manager.getAppWidgetIds(android.content.ComponentName(context, FocusWidgetProvider::class.java))
        for (id in ids) updateWidget(context, manager, id)
    }
}
