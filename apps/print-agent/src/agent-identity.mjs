import {mkdirSync} from 'node:fs';
// Display name may change; the existing pairing/profile directory must not.
export const agentName='posjung-agent';
export function configureAgentIdentity(app,ensureDirectory=directory=>mkdirSync(directory,{recursive:true,mode:0o700})){
 const directory=app.getPath('userData');
 ensureDirectory(directory);
 app.setPath('userData',directory);
 app.setName(agentName);
 return directory;
}
