import { afterEach } from 'vitest';
import { setBindings } from './cloudflare-workers';

// Each test starts with a Worker that has no bindings, whatever the previous test set.
afterEach(() => setBindings());
