import { useEffect, useRef } from 'react';
import type { Copy } from '../i18n';
import { OverlayPortal } from './OverlayPortal';
import { Button, Icon } from './ui';

export function HelpCenter({ open, copy, onClose, onOpenObjects }: {
    open: boolean;
    copy: Copy['common'];
    onClose: (restoreFocus?: boolean) => void;
    onOpenObjects: () => void;
}) {
    const panelRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        const appRoot = document.getElementById('root');
        const previousInert = appRoot?.inert ?? false;
        document.body.style.overflow = 'hidden';
        if (appRoot) appRoot.inert = true;
        const focusFrame = window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('.help-open-objects')?.focus());
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== 'Tab') return;
            const panel = panelRef.current;
            if (!panel) return;
            const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const focusIsOutside = !panel.contains(document.activeElement);
            if (!first || !last) {
                event.preventDefault();
                panel.focus();
            } else if (event.shiftKey && (document.activeElement === first || focusIsOutside)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || focusIsOutside)) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            if (appRoot) appRoot.inert = previousInert;
        };
    }, [onClose, open]);

    if (!open) return null;

    return <OverlayPortal><div className="help-center-backdrop" onClick={event => {
        if (event.target === event.currentTarget) onClose();
    }}>
        <section ref={panelRef} id="help-center-panel" className="help-center-panel" role="dialog" aria-modal="true" aria-labelledby="help-center-title" tabIndex={-1}>
            <header className="help-center-header">
                <div><span className="eyebrow">{copy.helpCenterEyebrow}</span><h2 id="help-center-title">{copy.helpCenterTitle}</h2><p>{copy.helpCenterDescription}</p></div>
                <button type="button" className="help-center-close" aria-label={copy.closeHelp} title={copy.closeHelp} onClick={() => onClose()}><Icon name="close"/></button>
            </header>
            <div className="help-center-content">
                <section className="help-feature-card" aria-labelledby="help-parts-title">
                    <div className="help-feature-copy">
                        <span className="help-feature-kicker"><Icon name="database"/>{copy.helpFeatureLabel}</span>
                        <h3 id="help-parts-title">{copy.helpPartsTitle}</h3>
                        <p>{copy.helpPartsDescription}</p>
                        <div className="help-feature-points">
                            <span><Icon name="table"/>{copy.helpPartsPartitions}</span>
                            <span><Icon name="chart"/>{copy.helpPartsMetrics}</span>
                            <span><Icon name="details"/>{copy.helpPartsStates}</span>
                            <span><Icon name="details"/>{copy.helpPartsMetadata}</span>
                        </div>
                    </div>
                    <div className="help-parts-illustration" role="img" aria-label={copy.helpPartsIllustration}>
                        <div className="help-parts-illustration-heading"><span>{copy.helpPartsIllustration}</span><span>{copy.helpPartsBySize}</span></div>
                        <div className="help-parts-partition">
                            <div className="help-parts-partition-label"><strong>2026-09</strong><small>{copy.helpPartition}</small></div>
                            <div className="help-parts-rows">
                                <div className="help-parts-row"><span><i/>{copy.helpPartOne}</span><b><i style={{ width: '88%' }}/></b></div>
                                <div className="help-parts-row"><span><i/>{copy.helpPartTwo}</span><b><i style={{ width: '51%' }}/></b></div>
                                <div className="help-parts-row"><span><i/>{copy.helpPartThree}</span><b><i style={{ width: '18%' }}/></b></div>
                            </div>
                        </div>
                        <div className="help-parts-illustration-footer"><span><i/>{copy.helpPartsActive}</span><span>{copy.helpPartsBarNote}</span></div>
                    </div>
                </section>
                <div className="help-center-lower">
                    <section className="help-center-steps" aria-labelledby="help-parts-steps-title">
                        <div className="help-section-heading"><span className="eyebrow">{copy.helpQuickStart}</span><h3 id="help-parts-steps-title">{copy.helpPartsOpenTitle}</h3></div>
                        <ol>
                            <li><span>01</span><p>{copy.helpPartsStepOne}</p></li>
                            <li><span>02</span><p>{copy.helpPartsStepTwo}</p></li>
                            <li><span>03</span><p>{copy.helpPartsStepThree}</p></li>
                        </ol>
                        <Button variant="primary" className="help-open-objects" onClick={() => { onClose(false); onOpenObjects(); }}><Icon name="schema"/>{copy.helpOpenObjects}</Button>
                    </section>
                    <aside className="help-center-note">
                        <span className="help-note-icon"><Icon name="details"/></span>
                        <span className="eyebrow">{copy.helpWhenSelected}</span>
                        <p>{copy.helpPartsSelectionNote}</p>
                    </aside>
                </div>
            </div>
        </section>
    </div></OverlayPortal>;
}
