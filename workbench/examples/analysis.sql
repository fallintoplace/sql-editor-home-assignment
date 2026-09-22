-- No database table required; this runs against the original assignment's ClickHouse too.
SELECT toDate('2026-01-01') + toUInt32(number) AS day,
       toUInt64((number + 1) * 10) AS events
FROM numbers(7);

-- UInt64 and Decimal values must remain exact in table/export, not JS doubles.
SELECT toUInt64('18446744073709551615') AS exact_uint64,
       toDecimal128('12345678901234567890.12', 2) AS exact_decimal,
       CAST(NULL AS Nullable(String)) AS missing,
       ['first', 'second'] AS labels;

-- Parameter form appears in the editor. Values are bound on the server.
SELECT number FROM numbers(10) WHERE number >= {minimum:UInt64};
