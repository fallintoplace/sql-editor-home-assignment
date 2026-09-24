import type { Copy } from '../i18n';
import { OverlayPortal } from './OverlayPortal';
import { Icon, cx } from './ui';

export function HelpExamplesButton({ copy, open, executionBarVisible, onOpen }: {
    copy: Copy['common'];
    open: boolean;
    executionBarVisible: boolean;
    onOpen: (opener: HTMLButtonElement) => void;
}) {
    return <OverlayPortal>
        <button
            type="button"
            className={cx('help-examples-button', executionBarVisible && 'is-above-execution-bar')}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="sql-examples-panel"
            title={copy.help}
            onClick={event => onOpen(event.currentTarget)}
        >
            <Icon name="help"/>
            <span>{copy.help}</span>
        </button>
    </OverlayPortal>;
}
