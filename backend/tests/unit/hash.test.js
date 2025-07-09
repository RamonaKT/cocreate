import { jest } from '@jest/globals';
import { hashIp } from '../../../frontend/src/scripts/hash.js';
import { TextEncoder } from 'util';

describe('hashIp', () => {

    let originalWindow;

    beforeEach(() => {
    originalWindow = global.window;
    global.TextEncoder = TextEncoder;
    });

    afterEach(() => {
    delete global.window;
    jest.restoreAllMocks();
    });

    it('should return \"0\" for an empty string input (insecure context)', async () => {
        global.window = {
        isSecureContext: false,
        crypto: undefined
        };

        const result = await hashIp('');
        expect(result).toBe('0');
    });

    it('should compute a simpleHash for a regular IP (fallback)', async () => {
    global.window = {
        isSecureContext: false,
        crypto: undefined
    };

    const result = await hashIp('192.168.1.1');
    expect(typeof result).toBe('string');
    expect(Number.isNaN(Number(result))).toBe(false); // ist eine Zahl
    expect(result.length).toBeGreaterThan(0);         // ist nicht leer
    });

    it('should return a SHA-256 hash in a secure context', async () => {
    const ip = '127.0.0.1';
    const encoded = new TextEncoder().encode(ip);

    const fakeDigest = jest.fn().mockResolvedValue(
        new Uint8Array([1, 2, 3, 4]).buffer
    );

    // Damit TextEncoder korrekt funktioniert:
    global.TextEncoder = TextEncoder;

    global.window = {};
    Object.defineProperty(global.window, 'isSecureContext', {
        value: true,
        configurable: true
    });
    Object.defineProperty(global.window, 'crypto', {
        value: {
        subtle: {
            digest: fakeDigest
        }
        },
        configurable: true
    });

    const result = await hashIp(ip);

    expect(fakeDigest).toHaveBeenCalledTimes(1);
    expect(fakeDigest).toHaveBeenCalledWith('SHA-256', encoded);
    expect(result).toBe('01020304');
    });

  it('should fall back to simpleHash in an insecure context', async () => {
    global.window = {
      isSecureContext: false,
      crypto: undefined
    };

    const result = await hashIp('127.0.0.1');
    expect(typeof result).toBe('string');
    expect(/\d+/.test(result)).toBe(true);
  });
});

