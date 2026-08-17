// Holding the decoded images prevents GC from throwing the decode away before
// anything actually paints them.
const warmed: HTMLImageElement[] = [];

// src/utils/preload.ts
export async function preloadImages(urls: string[]) {
  const unique = Array.from(new Set(urls)).filter(Boolean);

  await Promise.all(
    unique.map((url) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = async () => {
          // decode() helps prevent pop-in when the image is first painted
          // (not supported everywhere, so we guard it)
          try {
            // @ts-ignore
            if (img.decode) await img.decode();
          } catch {
            // ignore decode errors; onload already fired
          }
          warmed.push(img);
          resolve();
        };
        img.onerror = () => {
          // Still resolve: one missing decoration shouldn't block boot. But say
          // so, or a typo'd path stays invisible forever (see: health_10.png).
          if (import.meta.env.DEV) {
            console.warn('[preload] failed to load', url);
          }
          resolve();
        };
        img.src = url;
      });
    })
  );
}
