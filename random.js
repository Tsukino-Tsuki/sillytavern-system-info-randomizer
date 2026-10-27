// 作者：wwj
export function randomIndex(size, cryptoSource = globalThis.crypto) {
    if (!Number.isInteger(size) || size < 1 || size > 0x100000000) throw new Error('随机候选数量无效');
    if (!cryptoSource?.getRandomValues) throw new Error('浏览器不支持 Web Crypto 随机数');
    const limit = Math.floor(0x100000000 / size) * size;
    const buffer = new Uint32Array(1);
    do { cryptoSource.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % size;
}

export function choose(items, index = randomIndex) {
    return items[index(items.length)];
}

export function randomSubset(items, minimum, maximum, index = randomIndex) {
    const pool = [...items];
    const low = Math.min(minimum, pool.length);
    const high = Math.min(maximum, pool.length);
    const count = low === high ? low : low + index(high - low + 1);
    const selected = [];
    while (selected.length < count) {
        selected.push(pool.splice(pool.length === 1 ? 0 : index(pool.length), 1)[0]);
    }
    return selected;
}

export function randomIdentifier(mode, length, index = randomIndex) {
    if (mode === 'uuid') {
        const hex = Array.from({ length: 32 }, () => '0123456789abcdef'[index(16)]);
        hex[12] = '4';
        hex[16] = '89ab'[index(4)];
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)]
            .map((part) => part.join('')).join('-');
    }
    const alphabet = mode === 'hex' ? '0123456789abcdef' : 'abcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => alphabet[index(alphabet.length)]).join('');
}
