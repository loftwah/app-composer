// Generated from src/browser/stack-share.ts; edit the source and run scripts/stack-share-assets.mjs --write.
// The public PNG and native attachment are the same publication-bound bytes.
// Only the QR is drawn locally; its address never goes to a third-party service.
import { currentShareURL } from './page-share-url.mjs';
import { qrMatrix } from './qr-code.mjs';
function read(element) {
    const source = element.querySelector('script[data-stack-share-data]')?.textContent ?? '';
    try {
        const value = JSON.parse(source);
        if (!value || typeof value !== 'object')
            return null;
        const data = value;
        if (typeof data.slug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(data.slug))
            return null;
        if (!Number.isSafeInteger(data.revision) || Number(data.revision) < 1)
            return null;
        if (typeof data.title !== 'string' || typeof data.description !== 'string')
            return null;
        const canonical = `https://composer.loftwah.com/s/${data.slug}`;
        if (data.url !== canonical || typeof data.imagePath !== 'string')
            return null;
        const prefix = `/s/${data.slug}/share/v2-r${data.revision}-`;
        if (!data.imagePath.startsWith(prefix) || !/^[a-f0-9]{64}\.png$/.test(data.imagePath.slice(prefix.length)))
            return null;
        if (data.imageUrl !== `https://composer.loftwah.com${data.imagePath}`)
            return null;
        return { slug: data.slug, revision: Number(data.revision), url: canonical, title: data.title, description: data.description, imagePath: data.imagePath, imageUrl: String(data.imageUrl) };
    }
    catch {
        return null;
    }
}
async function shareAddress(data) {
    const title = data.title.includes('App Composer') ? data.title : `${data.title} · App Composer`;
    try {
        return await currentShareURL(data.url, title, data.description, data.imageUrl);
    }
    catch {
        return data.url;
    }
}
export function stackQrBlob(url) {
    const matrix = qrMatrix(url);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext('2d');
    if (!context)
        return Promise.reject(Error('The QR image could not be produced. Copy the published address instead.'));
    const quiet = 4;
    const unit = Math.floor(640 / (matrix.size + quiet * 2));
    const offset = Math.floor((640 - matrix.size * unit) / 2);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 640, 640);
    context.fillStyle = '#17181b';
    for (let row = 0; row < matrix.size; row += 1) {
        for (let column = 0; column < matrix.size; column += 1) {
            if (matrix.modules[row][column])
                context.fillRect(offset + column * unit, offset + row * unit, unit, unit);
        }
    }
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('The QR image could not be produced. Copy the published address instead.')), 'image/png'));
}
export async function stackShareArtifacts(element) {
    const data = read(element);
    if (!data)
        throw Error('This page has no published stack to share.');
    // Resolve on this origin so preview/local checks never request production.
    // The path is validated above and cannot be an arbitrary URL or redirect.
    const response = await fetch(data.imagePath, { credentials: 'omit', redirect: 'error', cache: 'no-store' });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'image/png') {
        throw Error('The published card is unavailable. Copy the address or download the QR code instead.');
    }
    return { url: data.url, shareUrl: await shareAddress(data), card: await response.blob(), qr: await stackQrBlob(data.url), title: data.title, slug: data.slug };
}
function save(blob, filename) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
}
for (const element of document.querySelectorAll('[data-stack-share]')) {
    const data = read(element);
    if (!data)
        continue;
    const status = element.querySelector('[data-stack-share-status]');
    const qrButton = element.querySelector('[data-stack-qr]');
    const copyButton = element.querySelector('[data-stack-copy]');
    const nativeButton = element.querySelector('[data-stack-native]');
    const fallback = element.querySelector('[data-stack-share-fallback]');
    const fallbackInput = fallback?.querySelector('input');
    let currentAddress = data.url;
    // Prepare the metadata revision ahead of the click so native sharing starts
    // inside its user gesture, including browsers with strict activation rules.
    void shareAddress(data).then(address => { currentAddress = address; });
    const report = (message) => { if (status)
        status.textContent = message; };
    let busy = false;
    const use = async (work) => {
        if (busy)
            return;
        busy = true;
        for (const button of [qrButton, copyButton, nativeButton])
            if (button)
                button.disabled = true;
        try {
            await work();
        }
        catch (error) {
            report(error instanceof Error ? error.message : 'Sharing is unavailable. Copy the published address below.');
        }
        finally {
            busy = false;
            for (const button of [qrButton, copyButton, nativeButton])
                if (button)
                    button.disabled = false;
        }
    };
    if (qrButton) {
        qrButton.hidden = false;
        qrButton.addEventListener('click', () => void use(async () => {
            save(await stackQrBlob(data.url), `${data.slug}-qr-code.png`);
            report('Saved the QR code for the published address.');
        }));
    }
    if (copyButton) {
        copyButton.hidden = false;
        copyButton.addEventListener('click', () => void use(async () => {
            const url = await shareAddress(data);
            try {
                await navigator.clipboard.writeText(url);
                report('Copied the published stack link.');
            }
            catch {
                if (fallback && fallbackInput) {
                    fallback.hidden = false;
                    fallbackInput.value = url;
                    fallbackInput.focus();
                    fallbackInput.select();
                }
                report('Select and copy the published address below.');
            }
        }));
    }
    if (typeof navigator.share === 'function' && nativeButton) {
        nativeButton.hidden = false;
        nativeButton.addEventListener('click', () => void use(async () => {
            try {
                // Start the share sheet in the user gesture; the browser can always
                // share the publication URL, including when it cannot attach files.
                await navigator.share({ title: data.title, text: data.description, url: currentAddress });
                report('Shared the published stack link.');
            }
            catch (error) {
                report(error instanceof DOMException && error.name === 'AbortError'
                    ? 'Sharing cancelled.'
                    : 'Sharing is unavailable. Use Copy stack link instead.');
            }
        }));
    }
}
