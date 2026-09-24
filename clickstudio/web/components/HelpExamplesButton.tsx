import type { Copy } from '../i18n';
import { OverlayPortal } from './OverlayPortal';
import { Icon, cx } from './ui';

export function HelpExamplesButton({ copy, open, placement, onOpen }: {
    copy: Copy['common'];
    open: boolean;
    placement: 'floating' | 'inline';
    onOpen: (opener: HTMLButtonElement) => void;
}) {
    const button = <button
        type="button"
        className={cx('help-examples-button', placement === 'floating' ? 'is-floating' : 'is-inline')}
        aria-label={copy.help}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="sql-examples-panel"
        title={copy.help}
        onClick={event => onOpen(event.currentTarget)}
    >
        <Icon name="help"/>
        <span>{copy.help}</span>
    </button>;
    return placement === 'floating' ? <OverlayPortal>{button}</OverlayPortal> : button;
}
