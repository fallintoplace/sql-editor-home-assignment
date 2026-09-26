import type { Json } from './types.js';
import { baseType } from './results.js';
import { parseNativeGeoText } from './geo.js';

/**
 * Decode one value emitted by JSONCompactStringsEachRowWithNamesAndTypes.
 * Wide integers stay strings so JavaScript never silently loses precision.
 */
export function decodeClickHouseStringValue(value: string, type: string, nullMarker: string): Json {
    if (value === nullMarker && nullableType(type)) return null;

    const base = baseType(type);
    if (/^(?:U?Int(?:8|16|32|64|128|256))$/.test(base) && /^-?\d+$/.test(value)) {
        try {
            const integer = BigInt(value);
            if (integer <= BigInt(Number.MAX_SAFE_INTEGER) && integer >= BigInt(Number.MIN_SAFE_INTEGER))
                return Number(value);
        } catch { }
        return value;
    }
    if (/^(?:Float(?:32|64)|BFloat16)$/.test(base)) {
        const number = Number(value);
        if (Number.isFinite(number)) return number;
    }

    return parseNativeGeoText(value, type) ?? value;
}
