import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { geoCentroid, geoGraticule10, geoMercator, geoPath, type GeoPermissibleObjects } from 'd3';
import { displayValue, numericType } from '../../shared/results';
import { nativeGeoColumns, nativeGeoType, prepareGeoFeatures, recommendGeo, type GeoFeature, type GeoRecommendation } from '../../shared/geo';
import type { Column, Result } from '../../shared/types';
import type { Locale } from '../i18n';

const WIDTH = 960;
const HEIGHT = 470;
const EMPTY_COLUMNS: Column[] = [];
const formatCount = (value: number, locale: Locale) => new Intl.NumberFormat(locale).format(value);
const geometryObject = (feature: GeoFeature): GeoPermissibleObjects => ({ type: 'Feature', properties: {}, geometry: feature.geometry } as GeoPermissibleObjects);

function MapCanvas({ prepared, columns, measureIndex, completeness, locale }: {
    prepared: ReturnType<typeof prepareGeoFeatures>;
    columns: Column[];
    measureIndex?: number;
    completeness: Result['completeness'];
    locale: Locale;
}) {
    const [selectedIndex, setSelectedIndex] = useState<number>();
    const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
    const drag = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | undefined>(undefined);
    const collection = useMemo(() => ({
        type: 'FeatureCollection',
        features: prepared.features.map(feature => geometryObject(feature)),
    } as GeoPermissibleObjects), [prepared.features]);
    const map = useMemo(() => {
        const projection = geoMercator();
        projection.fitExtent([[34, 28], [WIDTH - 34, HEIGHT - 28]], collection);
        const center = geoCentroid(collection);
        if (!Number.isFinite(projection.scale()) || projection.scale() > 65_000)
            projection.center(center).scale(65_000).translate([WIDTH / 2, HEIGHT / 2]);
        const path = geoPath(projection);
        return {
            projection,
            path,
            sphere: path({ type: 'Sphere' }),
            graticule: path(geoGraticule10()),
        };
    }, [collection]);
    const measures = prepared.features.flatMap(feature => feature.measure === null ? [] : [feature.measure]);
    const minimum = Math.min(...measures, 0), maximum = Math.max(...measures, 0), range = maximum - minimum;
    const intensity = (feature: GeoFeature) => feature.measure === null ? 34
        : range === 0 ? 76 : 28 + 66 * ((feature.measure - minimum) / range);
    const pointRadius = (feature: GeoFeature) => feature.measure === null || range === 0 ? 5
        : 4 + 6 * Math.sqrt(Math.max(0, (feature.measure - minimum) / range));
    const selected = selectedIndex === undefined ? undefined : prepared.features[selectedIndex];
    const zoom = (factor: number) => setViewport(current => ({ ...current, scale: Math.max(1, Math.min(8, current.scale * factor)) }));
    const reset = () => setViewport({ x: 0, y: 0, scale: 1 });
    const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: viewport.x, originY: viewport.y };
    };
    const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const scaleX = WIDTH / Math.max(1, rect.width), scaleY = HEIGHT / Math.max(1, rect.height);
        setViewport(value => ({ ...value, x: current.originX + (event.clientX - current.x) * scaleX, y: current.originY + (event.clientY - current.y) * scaleY }));
    };
    const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = undefined;
    };
    return <>
        <div className="geo-stage">
            <div className="geo-map-tools" role="group" aria-label="Map view controls">
                <button type="button" onClick={() => zoom(1.35)} aria-label="Zoom in">+</button>
                <button type="button" onClick={() => zoom(1 / 1.35)} aria-label="Zoom out">−</button>
                <button type="button" onClick={reset}>Fit</button>
            </div>
            <svg className="geo-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Spatial result map with ${prepared.features.length} rendered features`} onClick={() => setSelectedIndex(undefined)} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
                <g transform={`translate(${viewport.x} ${viewport.y}) translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${viewport.scale}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`}>
                    {map.sphere && <path className="geo-sphere" d={map.sphere}/>}
                    {map.graticule && <path className="geo-graticule" d={map.graticule}/>}
                    {prepared.features.map((feature, index) => {
                        const style = { '--geo-intensity': `${Math.round(intensity(feature))}%` } as CSSProperties;
                        if (feature.geometry.type === 'Point') {
                            const projected = map.projection(feature.geometry.coordinates);
                            if (!projected) return null;
                            return <circle key={`${feature.rowIndex}-${index}`} className={`geo-feature geo-point${selectedIndex === index ? ' is-selected' : ''}`} cx={projected[0]} cy={projected[1]} r={pointRadius(feature)} style={style} onClick={event => { event.stopPropagation(); setSelectedIndex(index); }}><title>{feature.label}{feature.measure === null ? '' : ` · ${feature.measure}`}</title></circle>;
                        }
                        const path = map.path(geometryObject(feature));
                        if (!path) return null;
                        const line = feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString';
                        return <path key={`${feature.rowIndex}-${index}`} className={`geo-feature${line ? ' is-line' : ' is-area'}${selectedIndex === index ? ' is-selected' : ''}`} d={path} style={style} onClick={event => { event.stopPropagation(); setSelectedIndex(index); }}><title>{feature.label}{feature.measure === null ? '' : ` · ${feature.measure}`}</title></path>;
                    })}
                </g>
            </svg>
            <div className="geo-map-caption">
                <span>{formatCount(prepared.totalFeatures, locale)} valid features{prepared.sampled ? ` · ${formatCount(prepared.features.length, locale)} rendered` : ''}</span>
                <span>{prepared.invalidRows ? `${formatCount(prepared.invalidRows, locale)} rows outside geographic bounds · ` : ''}{completeness === 'truncated' ? 'retained prefix only' : 'complete retained result'}</span>
            </div>
        </div>
        <div className="geo-detail-row">
            <div className="geo-legend"><span className="geo-gradient"/><div><strong>{measureIndex === undefined ? 'Features' : columns[measureIndex]?.name}</strong><small>{measureIndex === undefined || !measures.length ? 'Uniform styling' : `${minimum.toLocaleString(locale)} → ${maximum.toLocaleString(locale)}`}</small></div></div>
            <div className="geo-selection">
                {selected ? <><div><span className="eyebrow">SELECTED FEATURE</span><strong>{selected.label}</strong></div><dl>{columns.slice(0, 6).map((column, index) => <div key={index}><dt>{column.name}</dt><dd>{displayValue(selected.row[index])}</dd></div>)}</dl></>
                    : <p>Select a point, line, or region to inspect its retained row.</p>}
            </div>
        </div>
    </>;
}

export function GeoView({ result, loading, locale }: { result?: Result; loading: boolean; locale: Locale }) {
    const columns = result?.columns ?? EMPTY_COLUMNS;
    const recommendation = useMemo(() => recommendGeo(columns), [columns]);
    const geometryColumns = useMemo(() => nativeGeoColumns(columns), [columns]);
    const numericColumns = useMemo(() => columns.flatMap((column, index) => numericType(column.type) ? [index] : []), [columns]);
    const [source, setSource] = useState('');
    const [longitude, setLongitude] = useState(-1);
    const [latitude, setLatitude] = useState(-1);
    const [label, setLabel] = useState(-1);
    const [measure, setMeasure] = useState(-1);
    const [swapCoordinates, setSwapCoordinates] = useState(false);

    useEffect(() => {
        if (!recommendation) return;
        if (recommendation.source.mode === 'geometry') setSource(`geometry:${recommendation.source.column}`);
        else {
            setSource('coordinates');
            setLongitude(recommendation.source.longitude);
            setLatitude(recommendation.source.latitude);
        }
        setLabel(recommendation.label ?? -1);
        setMeasure(recommendation.measure ?? -1);
        setSwapCoordinates(recommendation.swapCoordinates);
    }, [recommendation]);

    const config = useMemo<GeoRecommendation | undefined>(() => {
        if (!source) return recommendation;
        const optional = { label: label >= 0 ? label : undefined, measure: measure >= 0 ? measure : undefined };
        if (source === 'coordinates') {
            if (longitude < 0 || latitude < 0 || longitude === latitude) return undefined;
            return { source: { mode: 'coordinates', longitude, latitude }, ...optional, swapCoordinates: false, reason: 'Selected longitude and latitude columns' };
        }
        const geometry = Number(source.slice('geometry:'.length));
        if (!Number.isSafeInteger(geometry) || !nativeGeoType(columns[geometry]?.type ?? '')) return undefined;
        return { source: { mode: 'geometry', column: geometry }, ...optional, swapCoordinates, reason: `Native ClickHouse ${nativeGeoType(columns[geometry]!.type)} column` };
    }, [columns, label, latitude, longitude, measure, recommendation, source, swapCoordinates]);
    const prepared = useMemo(() => result && config ? prepareGeoFeatures(result.rows, result.columns, config) : undefined, [config, result]);

    if (loading || !result) return <div className="result-loading"><span className="loading-orbit"/><span>Preparing spatial result…</span></div>;
    if (!recommendation || !config) return <div className="chart-empty">Return a native ClickHouse geometry column or named longitude/latitude columns to open Map.</div>;
    const coordinateModeAvailable = numericColumns.length >= 2;
    const measureOptions = numericColumns.filter(index => config.source.mode !== 'coordinates' || (index !== config.source.longitude && index !== config.source.latitude));
    return <div className="geo-workspace animate-enter">
        <div className="geo-title-row">
            <div><span className="eyebrow">CLICKHOUSE GEO</span><h3>Spatial explorer</h3><p>{config.reason}. Geometry is rendered from the bounded retained result, without extra SQL or external map services.</p></div>
            <div className="chart-controls geo-controls">
                <label>Source<select value={source} onChange={event => {
                    const next = event.target.value;
                    setSource(next);
                    if (next.startsWith('geometry:')) {
                        const index = Number(next.slice('geometry:'.length));
                        setSwapCoordinates(/h3/i.test(columns[index]?.name ?? ''));
                    }
                }}>{geometryColumns.map(index => <option key={index} value={`geometry:${index}`}>{columns[index]?.name} · {nativeGeoType(columns[index]?.type ?? '')}</option>)}{coordinateModeAvailable && <option value="coordinates">Longitude / latitude</option>}</select></label>
                {source === 'coordinates' && <><label>Longitude<select value={longitude} onChange={event => setLongitude(Number(event.target.value))}>{numericColumns.map(index => <option key={index} value={index} disabled={index === latitude}>{columns[index]?.name}</option>)}</select></label><label>Latitude<select value={latitude} onChange={event => setLatitude(Number(event.target.value))}>{numericColumns.map(index => <option key={index} value={index} disabled={index === longitude}>{columns[index]?.name}</option>)}</select></label></>}
                <label>Label<select value={label} onChange={event => setLabel(Number(event.target.value))}><option value={-1}>Row number</option>{columns.map((column, index) => <option key={index} value={index}>{column.name}</option>)}</select></label>
                <label>Measure<select value={measure} onChange={event => setMeasure(Number(event.target.value))}><option value={-1}>None</option>{measureOptions.map(index => <option key={index} value={index}>{columns[index]?.name}</option>)}</select></label>
                {source.startsWith('geometry:') && <label className="geo-swap"><span>Coordinate order</span><button type="button" aria-pressed={swapCoordinates} onClick={() => setSwapCoordinates(value => !value)}>{swapCoordinates ? 'Y / X' : 'X / Y'}</button></label>}
            </div>
        </div>
        {!prepared?.features.length ? <div className="chart-empty">No returned rows contain valid longitude/latitude geometry for this selection.</div>
            : <MapCanvas prepared={prepared} columns={columns} measureIndex={config.measure} completeness={result.completeness} locale={locale}/>}
    </div>;
}
