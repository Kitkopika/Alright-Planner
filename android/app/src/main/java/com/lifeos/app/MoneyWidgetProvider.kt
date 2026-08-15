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
 * "Alright — Money" widget: today's spending summary (spent / earned / net)
 * plus the latest transactions, in the app's currency.
 */
class MoneyWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val MAX_ROWS = 3
        private val ROW_IDS = intArrayOf(R.id.money_row0, R.id.money_row1, R.id.money_row2)
        private val TIME_IDS = intArrayOf(R.id.money_row0_time, R.id.money_row1_time, R.id.money_row2_time)
        private val TITLE_IDS = intArrayOf(R.id.money_row0_title, R.id.money_row1_title, R.id.money_row2_title)
        private val AMOUNT_IDS = intArrayOf(R.id.money_row0_amount, R.id.money_row1_amount, R.id.money_row2_amount)

        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = try {
                buildViews(context, widgetId)
            } catch (e: Exception) {
                // Never let the widget render blank because of a render error.
                RemoteViews(context.packageName, R.layout.money_widget)
            }
            manager.updateAppWidget(widgetId, views)
        }

        private fun buildViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.money_widget)
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(
                    context, 0, Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            )
            views.setTextViewText(R.id.widget_date, java.text.SimpleDateFormat("EEE d MMM", java.util.Locale.getDefault()).format(java.util.Calendar.getInstance().time))

            val doc = WidgetData.readDocument(context)
            val currency = WidgetData.readCurrency(context)
            val today = WidgetData.todayKey()
            val summary = doc?.let { moneySummary(it, today, currency) }

            if (summary != null) {
                views.setTextViewText(R.id.money_spent, WidgetData.formatMoney(summary.spent, currency))
                views.setTextViewText(R.id.money_earned, WidgetData.formatMoney(summary.earned, currency))
                views.setTextViewText(R.id.money_net, WidgetData.formatMoney(summary.net, currency))
                views.setInt(R.id.money_net, "setTextColor", if (summary.net >= 0) 0xFF16A34A.toInt() else 0xFFDC2626.toInt())

                val rowCount = WidgetData.rowLimit(context, widgetId, MAX_ROWS)
                for (i in 0 until MAX_ROWS) {
                    val visible = i < rowCount && i < summary.recent.size
                    views.setViewVisibility(ROW_IDS[i], if (visible) View.VISIBLE else View.GONE)
                    if (visible) {
                        val txn = summary.recent[i]
                        views.setTextViewText(TIME_IDS[i], txn.time)
                        views.setTextViewText(TITLE_IDS[i], txn.title)
                        views.setTextViewText(AMOUNT_IDS[i], txn.amount)
                    }
                }
                views.setViewVisibility(R.id.widget_empty, if (summary.recent.isEmpty()) View.VISIBLE else View.GONE)
                views.setTextViewText(R.id.widget_empty, if (summary.recent.isEmpty()) "No transactions today" else "")
            } else {
                views.setTextViewText(R.id.money_spent, WidgetData.formatMoney(0, currency))
                views.setTextViewText(R.id.money_earned, WidgetData.formatMoney(0, currency))
                views.setTextViewText(R.id.money_net, WidgetData.formatMoney(0, currency))
                views.setViewVisibility(R.id.widget_empty, View.VISIBLE)
                views.setTextViewText(R.id.widget_empty, "Open Alright to track money")
                for (id in ROW_IDS) views.setViewVisibility(id, View.GONE)
            }
            return views
        }

        private data class Txn(val time: String, val title: String, val amount: String)
        private data class MoneySummary(val spent: Long, val earned: Long, val net: Long, val recent: List<Txn>)

        private fun moneySummary(doc: JSONObject, today: String, currency: String): MoneySummary {
            val collections = doc.optJSONObject("data")?.optJSONObject("collections") ?: return MoneySummary(0, 0, 0, emptyList())
            val txns = collections.optJSONArray("transactions")
            // Build category id -> name from the categories array.
            val catNames = mutableMapOf<String, String>()
            collections.optJSONArray("categories")?.let { cats ->
                for (i in 0 until cats.length()) {
                    val c = cats.optJSONObject(i) ?: continue
                    catNames[c.optString("id")] = c.optString("name")
                }
            }
            var spent = 0L
            var earned = 0L
            val recent = mutableListOf<Txn>()
            if (txns != null) {
                val list = mutableListOf<JSONObject>()
                for (i in 0 until txns.length()) {
                    val t = txns.optJSONObject(i) ?: continue
                    if (!WidgetData.isDeleted(t) && t.optString("occurredAt").take(10) == today) list.add(t)
                }
                list.sortByDescending { it.optString("occurredAt") }
                for (t in list) {
                    val cents = t.optLong("amountCents", 0L)
                    if (t.optString("kind2") == "expense") spent += cents else earned += cents
                }
                for (t in list.take(3)) {
                    val cents = t.optLong("amountCents", 0L)
                    val isExpense = t.optString("kind2") == "expense"
                    val note = t.optString("note")
                    val title = note.ifBlank { catNames[t.optString("categoryId")].orEmpty().ifBlank { if (isExpense) "Expense" else "Income" } }
                    val sign = if (isExpense) "-" else "+"
                    recent.add(Txn(WidgetData.hhmm(t.optString("occurredAt")), title, sign + WidgetData.formatMoney(cents, currency)))
                }
            }
            return MoneySummary(spent, earned, earned - spent, recent)
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
        val ids = manager.getAppWidgetIds(android.content.ComponentName(context, MoneyWidgetProvider::class.java))
        for (id in ids) updateWidget(context, manager, id)
    }
}
