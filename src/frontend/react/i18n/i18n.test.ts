import { describe, it, expect } from 'vitest';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

// Helper to get all nested keys from an object as dot-separated strings
const getKeys = (obj: any, prefix = ''): string[] => {
    return Object.keys(obj).reduce((res: string[], el: string) => {
        if (typeof obj[el] === 'object' && obj[el] !== null) {
            return [...res, ...getKeys(obj[el], prefix + el + '.')];
        }
        return [...res, prefix + el];
    }, []);
};

// Helper to find empty string values
const getEmptyValues = (obj: any, prefix = ''): string[] => {
    return Object.keys(obj).reduce((res: string[], el: string) => {
        if (typeof obj[el] === 'object' && obj[el] !== null) {
            return [...res, ...getEmptyValues(obj[el], prefix + el + '.')];
        }
        if (obj[el] === '') {
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
