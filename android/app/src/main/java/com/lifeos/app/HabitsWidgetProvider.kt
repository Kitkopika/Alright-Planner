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
 * "Alright — Habits" widget: today's habits (✓ done / ○ not yet) and routines
 * (steps done), with their color accents. Rows scale with the widget height.
 */
class HabitsWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val MAX_ROWS = 6
        private val ROW_IDS = intArrayOf(R.id.habit_row0, R.id.habit_row1, R.id.habit_row2, R.id.habit_row3, R.id.habit_row4, R.id.habit_row5)
        private val DOT_IDS = intArrayOf(R.id.habit_row0_dot, R.id.habit_row1_dot, R.id.habit_row2_dot, R.id.habit_row3_dot, R.id.habit_row4_dot, R.id.habit_row5_dot)
        private val STATUS_IDS = intArrayOf(R.id.habit_row0_status, R.id.habit_row1_status, R.id.habit_row2_status, R.id.habit_row3_status, R.id.habit_row4_status, R.id.habit_row5_status)
        private val TITLE_IDS = intArrayOf(R.id.habit_row0_title, R.id.habit_row1_title, R.id.habit_row2_title, R.id.habit_row3_title, R.id.habit_row4_title, R.id.habit_row5_title)

        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            manager.updateAppWidget(widgetId, buildViews(context, widgetId))
        }

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.habits_widget)
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
            val items = doc?.let { habitItems(it, today) }.orEmpty()
            val rowCount = WidgetData.rowLimit(context, widgetId, MAX_ROWS)

            var doneCount = 0
            for (i in 0 until MAX_ROWS) {
                val visible = i < rowCount && i < items.size
                views.setViewVisibility(ROW_IDS[i], if (visible) View.VISIBLE else View.GONE)
                if (visible) {
                    val item = items[i]
                    views.setInt(DOT_IDS[i], "setBackgroundColor", item.color)
                    views.setTextViewText(TITLE_IDS[i], item.title)
                    views.setTextViewText(STATUS_IDS[i], item.status)
                    views.setInt(STATUS_IDS[i], "setTextColor", if (item.done) 0xFF16A34A.toInt() else 0xFF9A9AA5.toInt())
                    if (item.done) doneCount++
                }
            }

            views.setViewVisibility(R.id.widget_empty, if (items.isEmpty()) View.VISIBLE else View.GONE)
            views.setTextViewText(
                R.id.widget_empty,
                if (doc == null) "Open Alright to add habits" else "No habits or routines today"
            )
            views.setTextViewText(R.id.widget_summary, if (doc != null) "$doneCount/${items.size} done" else "")
            views.setViewVisibility(R.id.widget_summary, if (doc != null) View.VISIBLE else View.GONE)

            return views
        }

        private data class HabitItem(val title: String, val status: String, val color: Int, val done: Boolean, val sortKey: String)

        private fun habitItems(doc: JSONObject, today: String): List<HabitItem> {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections") ?: return emptyList()
            val out = mutableListOf<HabitItem>()
            val cal = java.util.Calendar.getInstance()
            val dow = (cal.get(java.util.Calendar.DAY_OF_WEEK) + 5) % 7 // 0 = Monday ... 6 = Sunday

            // Habits scheduled/completed today.
            collections.optJSONArray("habits")?.let { habits ->
                for (i in 0 until habits.length()) {
                    val h = habits.optJSONObject(i) ?: continue
                    if (WidgetData.isDeleted(h)) continue
                    if (h.optBoolean("archived", false)) continue
                    val done = h.optJSONArray("completions")?.let { c ->
                        for (j in 0 until c.length()) if (c.optString(j) == today) return@let true
                        false
                    } ?: false
                    out.add(HabitItem(h.optString("name"), if (done) "✓" else "○", WidgetData.parseColor(h.optString("color")), done, "0${h.optString("name")}"))
                }
            }

            // Routines scheduled today, with step progress.
            val completions = mutableListOf<JSONObject>()
            collections.optJSONArray("routineCompletions")?.let { rc ->
                for (i in 0 until rc.length()) {
                    val c = rc.optJSONObject(i) ?: continue
                    if (c.optString("date") == today) completions.add(c)
                }
            }
            collections.optJSONArray("routines")?.let { routines ->
                for (i in 0 until routines.length()) {
                    val r = routines.optJSONObject(i) ?: continue
                    if (WidgetData.isDeleted(r)) continue
                    val scheduled = r.optJSONArray("weekdays")?.let { wd ->
                        for (j in 0 until wd.length()) if (wd.optInt(j) == dow) return@let true
                        false
                    } ?: false
                    if (!scheduled) continue
                    val completion = completions.firstOrNull { it.optString("routineId") == r.optString("id") }
                    val steps = r.optJSONArray("steps")?.length() ?: 0
                    val done = completion?.optJSONArray("doneStepIds")?.length() ?: 0
                    out.add(HabitItem(r.optString("name"), "$done/$steps", WidgetData.parseColor(r.optString("color")), done >= steps && steps > 0, "1${r.optString("name")}"))
                }
            }

            out.sortWith(compareBy<HabitItem> { it.sortKey }.thenBy { it.title })
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
        val ids = manager.getAppWidgetIds(android.content.ComponentName(context, HabitsWidgetProvider::class.java))
        for (id in ids) updateWidget(context, manager, id)
    }
}
