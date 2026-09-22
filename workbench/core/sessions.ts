import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Principal } from '../shared/types.js';
import { requireThat } from './errors.js';
interface Session {
    principal: Principal;
    expiresAt: number;
}
/** One owner workspace. Share tokens are separate, read-only capabilities, not login credentials. */
export class SessionService {
    private sessions = new Map<string, Session>();
    private attempts = new Map<string, {
        count: number;
        until: number;
    }>();
    constructor(private readonly token?: string) { }
    private digest(s: string) { return createHash('sha256').update(s).digest(); }
    get requiresLogin() { return Boolean(this.token); }
    principal(cookie?: string): Principal | undefined {
        if (!this.token)
            return { id: 'local-owner', role: 'owner' };
        const token = cookie?.split(';').map(p => p.trim()).find(p => p.startsWith('workbench_session='))?.slice('workbench_session='.length);
        if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
            return;
        const key = this.digest(token).toString('hex'), session = this.sessions.get(key);
        if (!session)
            return;
        if (session.expiresAt <= Date.now()) {
            this.sessions.delete(key);
            return;
        }
        return { ...session.principal };
    }
    login(value: unknown, address: string): string {
        const now = Date.now();
        for (const [key, a] of this.attempts)
            if (a.until <= now)
                this.attempts.delete(key);
        requireThat(this.attempts.size < 1000 || this.attempts.has(address), 429, 'LOGIN_CAPACITY', 'Please retry later');
        const attempts = this.attempts.get(address) ?? { count: 0, until: now + 600000 };
        attempts.count++;
        this.attempts.set(address, attempts);
        requireThat(attempts.count <= 10, 429, 'LOGIN_RATE_LIMIT', 'Too many login attempts. Retry after ten minutes.');
        requireThat(typeof value === 'string' && value.length <= 4096 && this.token && timingSafeEqual(this.digest(value), this.digest(this.token)), 401, 'INVALID_TOKEN', 'The workspace access token is invalid');
        for (const [key, s] of this.sessions)
            if (s.expiresAt <= now)
                this.sessions.delete(key);
        requireThat(this.sessions.size < 30, 429, 'SESSION_LIMIT', 'Too many active sessions');
        const token = randomBytes(32).toString('base64url');
        this.sessions.set(this.digest(token).toString('hex'), { principal: { id: 'local-owner', role: 'owner' }, expiresAt: now + 12 * 3600000 });
        return token;
    }
    logout(cookie?: string) { const token = cookie?.split(';').map(p => p.trim()).find(p => p.startsWith('workbench_session='))?.slice('workbench_session='.length); if (token)
        this.sessions.delete(this.digest(token).toString('hex')); }
}
