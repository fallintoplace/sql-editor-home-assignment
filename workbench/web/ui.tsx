import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Button, Dialog, TextField } from '@clickhouse/click-ui';
export { Select, TextAreaField, TextField } from '@clickhouse/click-ui';
/** Thin defaults only: Click UI owns button styling, focus behavior and disabled states. */
export function Action({ type = 'secondary', htmlType = 'button', ...props }: ComponentProps<typeof Button>) { return <Button type={type} htmlType={htmlType} {...props}/>; }
export function Callout({ children, danger = false }: {
    children: ReactNode;
    danger?: boolean;
}) { return <div className={danger ? 'callout danger' : 'callout'} role={danger ? 'alert' : 'status'}>{children}</div>; }
export function HelpTip({ children }: { children: ReactNode }) {
    const id = useId();
    return <span className="help-tip" tabIndex={0} aria-describedby={id}>
        <span className="help-tip-icon" aria-hidden="true">?</span>
        <span id={id} className="help-tip-popover" role="tooltip">{children}</span>
    </span>;
}
interface Confirmation {
    title: string;
    description: string;
    required?: string;
    resolve: (value: boolean) => void;
}
export function useConfirmation() {
    const [state, setState] = useState<Confirmation>(), [value, setValue] = useState('');
    const close = (answer: boolean) => { state?.resolve(answer); setState(undefined); setValue(''); };
    return { ask: (title: string, description: string, required?: string) => new Promise<boolean>(resolve => { setValue(''); setState({ title, description, required, resolve }); }),
        dialog: <Dialog open={Boolean(state)} onOpenChange={open => { if (!open)
            close(false); }}><Dialog.Content title={state?.title ?? 'Confirm action'} description={state?.description} showClose>
     {state?.required && <TextField label={`Type ${state.required} to confirm`} value={value} onChange={setValue} autoFocus/>}
     <div className="toolbar mt-4"><Action onClick={() => close(false)}>Cancel</Action><Action type="primary" disabled={Boolean(state?.required) && value !== state?.required} onClick={() => close(true)}>Confirm</Action></div>
   </Dialog.Content></Dialog> };
}
