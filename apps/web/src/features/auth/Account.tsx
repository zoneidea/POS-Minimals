import { Store, UserRound, ShieldCheck } from 'lucide-react';
import type { UserContext } from '../../../../../packages/contracts/src/index';
export function Account({user}:{user:UserContext}) { return <div className="account"><p><Store aria-hidden="true"/>{user.orgName}</p><p><UserRound aria-hidden="true"/>{user.username}</p><p><ShieldCheck aria-hidden="true"/>{({OWNER:'เจ้าของร้าน',EMPLOYEE:'พนักงาน',ACCOUNTANT:'บัญชี'})[user.role]}</p></div>; }
