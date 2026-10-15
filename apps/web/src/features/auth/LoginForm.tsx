import {useActionError} from '../../lib/use-action-feedback';
import { useState } from 'react';
import {LoginFields} from './LoginFields';
import { Notice } from '../../components/Notice';
import { auth, authMessage } from '../../lib/client';
export function LoginForm({disabled=false}:{disabled?:boolean}) {
 const [busy,setBusy]=useState(false), [error,setError]=useActionError();
 return <form onSubmit={async e => {e.preventDefault();if(disabled||busy)return;const values=new FormData(e.currentTarget);setBusy(true);setError('');try {const {error}=await auth.auth.signInWithPassword({email:String(values.get('email')).trim(),password:String(values.get('password'))});if(error) throw error;} catch(error){setError(authMessage(error));}finally{setBusy(false);}}}>
 {error ? <Notice>{error}</Notice> : null}<LoginFields busy={busy} preparing={disabled}/></form>;
}
