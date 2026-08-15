package com.lifeos.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

/**
 * "Alright — Goals" widget: active goals with their progress % and deadline.
 * Rows scale with the widget height.
 */
class GoalsWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val MAX_ROWS = 6
        private val ROW_IDS = intArrayOf(R.id.goal_row0, R.id.goal_row1, R.id.goal_row2, R.id.goal_row3, R.id.goal_row4, R.id.goal_row5)
        private val DOT_IDS = intArrayOf(R.id.goal_row0_dot, R.id.goal_row1_dot, R.id.goal_row2_dot, R.id.goal_row3_dot, R.id.goal_row4_dot, R.id.goal_row5_dot)
        private val TITLE_IDS = intArrayOf(R.id.goal_row0_title, R.id.goal_row1_title, R.id.goal_row2_title, R.id.goal_row3_title, R.id.goal_row4_title, R.id.goal_row5_title)
        private val PCT_IDS = intArrayOf(R.id.goal_row0_pct, R.id.goal_row1_pct, R.id.goal_row2_pct, R.id.goal_row3_pct, R.id.goal_row4_pct, R.id.goal_row5_pct)

        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = try {
                buildViews(context, widgetId)
            } catch (e: Exception) {
                // Never let the widget render blank because of a render error.
                RemoteViews(context.packageName, R.layout.goals_widget)
            }
            manager.updateAppWidget(widgetId, views)
        }

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.goals_widget)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(
                    context, 0, Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            )
            views.setTextViewText(R.id.widget_date, java.text.SimpleDateFormat("EEE d MMM", java.util.Locale.getDefault()).format(java.util.Calendar.getInstance().time))

            val doc = WidgetData.readDocument(context)
            val items = doc?.let { goalItems(it) }.orEmpty()
            val rowCount = WidgetData.rowLimit(context, widgetId, MAX_ROWS)

            for (i in 0 until MAX_ROWS) {
                val visible = i < rowCount && i < items.size
                views.setViewVisibility(ROW_IDS[i], if (visible) View.VISIBLE else View.GONE)
                if (visible) {
                    val item = items[i]
                    views.setInt(DOT_IDS[i], "setBackgroundColor", item.color)
                    views.setTextViewText(TITLE_IDS[i], item.title)
                    views.setTextViewText(PCT_IDS[i], "${item.pct}%")
                }
            }

            views.setViewVisibility(R.id.widget_empty, if (items.isEmpty()) View.VISIBLE else View.GONE)
            views.setTextViewText(
                R.id.widget_empty,
                if (doc == null) "Open Alright to add goals" else "No active goals"
            )
            return views
        }

        private data class GoalItem(val title: String, val pct: Int, val color: Int)

        private fun goalItems(doc: JSONObject): List<GoalItem> {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections") ?: return emptyList()
            val goals = collections.optJSONArray("goals") ?: return emptyList()
            val projects = collections.optJSONArray("projects")
            val tasks = collections.optJSONArray("tasks")
            val out = mutableListOf<GoalItem>()
            for (i in 0 until goals.length()) {
                val g = goals.optJSONObject(i) ?: continue
                if (WidgetData.isDeleted(g)) continue
                if (g.optString("status") != "active") continue
                val pct = goalProgress(collections, g.optString("id"), projects, tasks)
                out.add(GoalItem(g.optString("title"), pct, WidgetData.parseColor(g.optString("color"))))
            }
            return out
        }

        /** Mirrors the app's goalProgress: done tasks / actionable tasks, else done projects. */
        private fun goalProgress(
            collections: JSONObject,
            goalId: String,
            projects: JSONArray?,
            tasks: JSONArray?
        ): Int {
            val projectIds = mutableSetOf<String>()
            var activeProjects = 0
            var doneProjects = 0
            projects?.let { arr ->
                for (i in 0 until arr.length()) {
                    val p = arr.optJSONObject(i) ?: continue
                    if (WidgetData.isDeleted(p) || p.optString("goalId") != goalId) continue
                    projectIds.add(p.optString("id"))
                    if (p.optString("status") != "archived") {
                        activeProjects++
                        if (p.optString("status") == "done") doneProjects++
                    }
                }
            }
            var actionable = 0
            var doneTasks = 0
            tasks?.let { arr ->
                for (i in 0 until arr.length()) {
                    val t = arr.optJSONObject(i) ?: continue
                    if (WidgetData.isDeleted(t)) continue
                    if (!projectIds.contains(t.optString("projectId"))) continue
                    if (t.optString("status") == "cancelled") continue
                    actionable++
                    if (t.optString("status") == "done") doneTasks++
                }
            }
            if (actionable > 0) return Math.round(doneTasks * 100f / actionable)
            if (activeProjects > 0) return Math.round(doneProjects * 100f / activeProjects)
            return 0
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
        val ids = manager.getAppWidgetIds(android.content.ComponentName(context, GoalsWidgetProvider::class.java))
        for (id in ids) updateWidget(context, manager, id)
    }
}
