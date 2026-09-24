import type { Copy } from '../i18n';
import { Icon } from './ui';

export function HelpExamplesButton({ copy, open, onOpen }: {
    copy: Copy['common'];
    open: boolean;
    onOpen: (opener: HTMLButtonElement) => void;
}) {
    return <button
        type="button"
        className="help-examples-button"
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
}
