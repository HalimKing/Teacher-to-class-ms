type SettingGroup = Record<string, { value?: unknown }> | undefined;

export function getBooleanSetting(group: SettingGroup, key: string, defaultValue = false): boolean {
    const value = group?.[key]?.value;

    if (value === true || value === 1 || value === '1') {
        return true;
    }

    if (value === false || value === 0 || value === '0') {
        return false;
    }

    return defaultValue;
}
