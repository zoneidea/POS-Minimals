import type {ReactNode} from 'react';
import {Modal} from '../../components/Modal';
// Shared checkout shell: both flows retain the same totals, cash keypad and action layout.
export function CheckoutFrame({title='Checkout — ชำระเงิน',busy,locked=false,onClose,feedback,summary,payment,actions,footer}:{title?:string;busy:boolean;locked?:boolean;onClose:()=>void;feedback?:ReactNode;summary:ReactNode;payment:ReactNode;actions:ReactNode;footer?:ReactNode}){
 return <Modal title={title} busy={busy} onClose={onClose}>{feedback}<fieldset disabled={busy||locked} className="checkout-fieldset"><div className="checkout-modal"><div className="checkout-summary">{summary}</div><div className="checkout-payment">{payment}</div><div className="category-actions">{actions}</div>{footer?<p className="cart-note">{footer}</p>:null}</div></fieldset></Modal>;
}
