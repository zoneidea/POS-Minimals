import { Tags } from 'lucide-react';
import type { UserContext } from '../../../../../packages/contracts/src/index';
import { Account } from './Account';
import { CategoriesPage } from '../categories/CategoriesPage';
import { Notice } from '../../components/Notice';
export function SignedInContent({user}:{user:UserContext}){
 if(window.location.pathname==='/categories')return user.role==='OWNER'?<CategoriesPage key={`${user.userId}:${user.orgId}`}/>:<Notice>เฉพาะเจ้าของร้านเท่านั้นที่จัดการหมวดหมู่ได้</Notice>;
 return <><Account user={user}/>{user.role==='OWNER'?<a className="primary" href="/categories"><Tags size={20} aria-hidden="true"/>จัดการหมวดหมู่สินค้า</a>:null}</>;
}
