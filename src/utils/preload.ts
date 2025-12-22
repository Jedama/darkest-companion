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
          resolve();
        };
        img.onerror = () => resolve(); // don't hard-fail the whole preload
        img.src = url;
      });
    })
  );
}
