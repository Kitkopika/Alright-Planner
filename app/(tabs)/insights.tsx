/**
 * Insights — task completion, habit/routine completion, focus time, spending
 * and goal progress for the week or month. Computed by `computeInsights`.
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLifeOS } from '../../src/data/store';
import { computeInsights, RangeLabel } from '../../src/features/insights';
import { formatMoney } from '../../src/features/finance';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Card, Chip, ChipRow, ProgressBar, SectionHeader } from '../../src/components/ui';
import { HBars, VBars } from '../../src/components/charts';

export default function InsightsScreen() {
  const data = useLifeOS((s) => s.data);
  const [range, setRange] = useState<RangeLabel>('week');

  const insights = useMemo(() => computeInsights(data, range), [data, range]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={typography.title}>Insights</Text>
        <ChipRow>
          <Chip label="Week" selected={range === 'week'} onPress={() => setRange('week')} />
          <Chip label="Month" selected={range === 'month'} onPress={() => setRange('month')} />
        </ChipRow>
      </View>

      <SectionHeader title="Tasks" />
      <StatCard
        icon="checkbox-outline"
        color={colors.accent}
        value={`${insights.tasks.done}/${insights.tasks.due}`}
        label={`${insights.tasks.rate}% completed`}
        pct={insights.tasks.rate}
        empty="No tasks due in this range"
      />

      <SectionHeader title="Habits" />
      <StatCard
        icon="repeat-outline"
        color={colors.success}
        value={`${insights.habits.rate}%`}
        label={`${insights.habits.done}/${insights.habits.scheduled} scheduled days done`}
        pct={insights.habits.rate}
        empty="No habits tracked"
        extra={insights.habits.bestStreak > 0 ? `Best streak 🔥 ${insights.habits.bestStreak}` : undefined}
      />
      <ChartCard title="Daily habit completion">
        <VBars values={insights.habitByDay} max={1} color={colors.success} labels={dayLabels(insights.dayKeys)} />
      </ChartCard>

      <SectionHeader title="Focus" />
      <StatCard
        icon="timer-outline"
        color={colors.warning}
        value={`${Math.floor(insights.focus.minutes / 60)}h ${insights.focus.minutes % 60}m`}
        label={`${insights.focus.sessions} sessions · ${insights.focus.avgMinutes} min avg`}
        empty="No focus sessions yet"
      />
      <ChartCard title="Focus minutes per day">
        <VBars values={insights.focusByDay} max={Math.max(1, ...insights.focusByDay)} color={colors.warning} labels={dayLabels(insights.dayKeys)} />
      </ChartCard>

      <SectionHeader title="Money" />
      <StatCard
        icon="wallet-outline"
        color={colors.danger}
        value={formatMoney(insights.spending.expenseCents)}
        label={`Spent this ${range} · earned ${formatMoney(insights.spending.incomeCents)}`}
        empty="No transactions"
        extra={
          insights.spending.topCategory
            ? `Top category: ${insights.spending.topCategory.name} (${formatMoney(insights.spending.topCategory.cents)})`
            : undefined
        }
      />
      {insights.spending.byCategory.length > 0 && (
        <ChartCard title="Spending by category">
          <HBars
            rows={insights.spending.byCategory.slice(0, 6).map((c) => ({
              label: c.name,
              value: c.cents,
              color: c.color,
              valueText: formatMoney(c.cents),
            }))}
          />
        </ChartCard>
      )}

      <SectionHeader title="Goals" />
      <Card>
        {insights.goals.active === 0 && insights.goals.done === 0 ? (
          <Text style={typography.caption}>No goals yet.</Text>
        ) : (
          <>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{insights.goals.active} active · {insights.goals.done} done</Text>
                <Text style={typography.caption}>Average progress across active goals</Text>
              </View>
              <Text style={[typography.body, { fontWeight: '700' }]}>{insights.goals.avgProgress}%</Text>
            </View>
            <ProgressBar pct={insights.goals.avgProgress} color={colors.warning} style={{ marginTop: spacing.sm }} />
          </>
        )}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          All insights are computed locally from your data. Nothing leaves this device.
        </Text>
      </Card>
    </ScrollView>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginTop: spacing.sm }}>
      <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.xs }]}>{title}</Text>
      {children}
    </Card>
  );
}

/** Short "DD" labels from date keys (day-of-month). */
function dayLabels(dayKeys: string[]): string[] {
  return dayKeys.map((k) => k.slice(8, 10).replace(/^0/, ''));
}

function StatCard({
  icon,
  color,
  value,
  label,
  pct,
  empty,
  extra,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  value: string;
  label: string;
  pct?: number;
  empty: string;
  extra?: string;
}) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { fontWeight: '700', fontSize: 18 }]}>{value}</Text>
          <Text style={typography.caption}>{label}</Text>
          {extra ? <Text style={[typography.caption, { color: colors.warning, marginTop: 2 }]}>{extra}</Text> : null}
        </View>
      </View>
      {pct !== undefined && <ProgressBar pct={pct} color={color} style={{ marginTop: spacing.sm }} />}
      {value === '' && <Text style={typography.caption}>{empty}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  header: { marginBottom: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
