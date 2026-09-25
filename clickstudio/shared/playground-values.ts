import type { Json } from './types.js';
import { baseType } from './results.js';
import { nativeGeoType, normalizeGeoGeometry } from './geo.js';

const MAX_GEO_LITERAL_LENGTH = 1_000_000;
const MAX_GEO_LITERAL_VALUES = 200_000;
const MAX_GEO_LITERAL_DEPTH = 8;
const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;

function nullableType(type: string) {
    let value = type;
    while ((value.startsWith('Nullable(') || value.startsWith('LowCardinality(')) && value.endsWith(')')) {
        if (value.startsWith('Nullable(')) return true;
        value = value.slice(value.indexOf('(') + 1, -1);
    }
    return false;
}

function parseGeoLiteral(input: string): Json | undefined {
    if (!input.length || input.length > MAX_GEO_LITERAL_LENGTH) return undefined;
    let index = 0;
    let values = 0;

    const whitespace = () => {
        while (index < input.length && /\s/.test(input[index]!)) index++;
    };
    const parseNumber = (): number | undefined => {
        const match = input.slice(index).match(numberPattern);
        if (!match) return undefined;
        const number = Number(match[0]);
        if (!Number.isFinite(number)) return undefined;
        index += match[0].length;
        values++;
        return values <= MAX_GEO_LITERAL_VALUES ? number : undefined;
    };
    const parseValue = (depth: number): Json | undefined => {
        if (depth > MAX_GEO_LITERAL_DEPTH) return undefined;
        whitespace();
        const open = input[index];
        if (open !== '(' && open !== '[') return parseNumber();
        const close = open === '(' ? ')' : ']';
        index++;
        whitespace();
        const items: Json[] = [];
        if (input[index] === close) {
            index++;
            return items;
        }
        while (index < input.length) {
            const item = parseValue(depth + 1);
            if (item === undefined) return undefined;
            items.push(item);
            whitespace();
            if (input[index] === close) {
                index++;
                return items;
            }
            if (input[index] !== ',') return undefined;
            index++;
            whitespace();
        }
        return undefined;
    };

    const parsed = parseValue(0);
    whitespace();
    return parsed !== undefined && index === input.length ? parsed : undefined;
}

function decodeNativeGeoString(value: string, type: string): Json | undefined {
    if (!nativeGeoType(type)) return undefined;
    const parsed = parseGeoLiteral(value);
    if (parsed === undefined || !normalizeGeoGeometry(parsed, type)) return undefined;
    return parsed;
}

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

    return decodeNativeGeoString(value, type) ?? value;
}
