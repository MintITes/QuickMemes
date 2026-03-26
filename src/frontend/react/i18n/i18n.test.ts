import { describe, it, expect } from 'vitest';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

// Helper to get all nested keys from an object as dot-separated strings
const getKeys = (obj: unknown, prefix = ''): string[] => {
    if (!isRecord(obj)) {
        return [];
    }

    return Object.keys(obj).reduce((res: string[], el: string) => {
        const value = obj[el];
        if (isRecord(value)) {
            return [...res, ...getKeys(value, `${prefix}${el}.`)];
        }
        return [...res, prefix + el];
    }, []);
};

// Helper to find empty string values
const getEmptyValues = (obj: unknown, prefix = ''): string[] => {
    if (!isRecord(obj)) {
        return [];
    }

    return Object.keys(obj).reduce((res: string[], el: string) => {
        const value = obj[el];
        if (isRecord(value)) {
            return [...res, ...getEmptyValues(value, `${prefix}${el}.`)];
        }
        if (value === '') {
            return [...res, prefix + el];
        }
        return res;
    }, []);
};

describe('i18n Locales Validation', () => {
    it('zh-CN and en-US should have exactly the same keys', () => {
        const zhKeys = getKeys(zhCN).sort();
        const enKeys = getKeys(enUS).sort();

        const missingInEn = zhKeys.filter(k => !enKeys.includes(k));
        const missingInZh = enKeys.filter(k => !zhKeys.includes(k));

        expect(missingInEn).toEqual([]);
        expect(missingInZh).toEqual([]);
    });

    it('zh-CN should not have any empty string translations', () => {
        const emptyZh = getEmptyValues(zhCN);
        expect(emptyZh).toEqual([]);
    });

    it('en-US should not have any empty string translations', () => {
        const emptyEn = getEmptyValues(enUS);
        expect(emptyEn).toEqual([]);
    });
});
