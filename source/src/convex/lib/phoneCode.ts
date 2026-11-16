import { sha256 } from "@oslojs/crypto/sha2";

export function codeHash(salt:string,code:string){return Array.from(sha256(new TextEncoder().encode(`${salt}:${code}`))).map(x=>x.toString(16).padStart(2,"0")).join("");}
