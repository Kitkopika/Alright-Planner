import { useSettings, normalizeHomeLayout, DEFAULT_HOME_LAYOUT, HOME_SECTION_IDS } from '../src/data/settings';

jest.mock('../src/data/persistence', () => ({
  getSettingsStore: () => ({ read: async () => null, write: async () => {} }),
}));

describe('home layout config', () => {
  it('normalizes missing input to the full default layout', () => {
    const layout = normalizeHomeLayout(undefined);
    expect(layout.map((s) => s.id)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(layout.every((s) => s.enabled && s.size === 'large')).toBe(true);
  });

  it('keeps the stored order and drops unknown ids', () => {
    const layout = normalizeHomeLayout([
      { id: 'quicknote', enabled: true, size: 'medium' },
      { id: 'progress', enabled: false, size: 'small' },
      { id: 'nope', enabled: true, size: 'large' },
    ]);
    expect(layout.map((s) => s.id)).toEqual(['quicknote', 'progress']);
    expect(layout.find((s) => s.id === 'progress')).toMatchObject({ enabled: false, size: 'small' });
    expect(layout.some((s) => (s.id as string) === 'nope')).toBe(false);
  });

  it('does NOT re-append a deliberately removed section', () => {
    const withoutTasks = DEFAULT_HOME_LAYOUT.filter((id) => id !== 'tasks').map((id) => ({ id, enabled: true, size: 'large' as const }));
    const layout = normalizeHomeLayout(withoutTasks);
    expect(layout.some((s) => s.id === 'tasks')).toBe(false);
  });

  it('preserves opt-in chart widgets once added', () => {
    const layout = normalizeHomeLayout([{ id: 'chartMoney', enabled: true, size: 'medium' }]);
    expect(layout.find((s) => s.id === 'chartMoney')).toMatchObject({ enabled: true, size: 'medium' });
    // Charts are NOT added back by normalization when absent.
    expect(normalizeHomeLayout(undefined).some((s) => s.id === 'chartMoney')).toBe(false);
  });

  it('setHomeLayout updates the store with a fresh reference', () => {
    const before = useSettings.getState().homeLayout;
    useSettings.getState().setHomeLayout([
      { id: 'money', enabled: true, size: 'small' },
      { id: 'quicknote', enabled: true, size: 'medium' },
    ]);
    const after = useSettings.getState().homeLayout;
    expect(after).not.toBe(before); // new array → subscribers re-render
    expect(after.map((s) => s.id)).toEqual(['money', 'quicknote']);
    expect(after.find((s) => s.id === 'money')).toMatchObject({ size: 'small' });
    expect(after.some((s) => s.id === 'tasks')).toBe(false); // removed stays removed
    void HOME_SECTION_IDS;
  });
});
