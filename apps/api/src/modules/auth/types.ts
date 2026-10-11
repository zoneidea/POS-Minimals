export type Role = 'OWNER' | 'EMPLOYEE' | 'ACCOUNTANT';
export interface UserContext {
  userId: string; orgId: string; orgName: string; username: string;
  role: Role; permissions: string[];
}
export type ResolveIdentity = (token: string) => Promise<UserContext>;
