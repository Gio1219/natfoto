export async function applyWatermark(
  file: File, 
  logoUrl: string = "/logo.png"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const logo = new Image();
    
    img.src = URL.createObjectURL(file);
    logo.src = logoUrl;

    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount++;
      if (loadedCount < 2) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Impossibile creare il contesto Canvas");

      // 1. Imposta le dimensioni reali della foto
      canvas.width = img.width;
      canvas.height = img.height;

      // 2. Disegna la foto originale
      ctx.drawImage(img, 0, 0);

      // 3. Calcola proporzioni dinamiche per il watermark
      const minDimension = Math.min(canvas.width, canvas.height);
      const watermarkWidth = minDimension * 0.22; // Occupazione 22%
      const aspectRatio = logo.height / logo.width;
      const watermarkHeight = watermarkWidth * aspectRatio;

      const padding = minDimension * 0.03; // Margine 3%
      const x = canvas.width - watermarkWidth - padding;
      const y = canvas.height - watermarkHeight - padding;

      // 4. Applica opacità leggera (es. 75%) per non rovinare lo scatto
      ctx.globalAlpha = 0.75;
      ctx.drawImage(logo, x, y, watermarkWidth, watermarkHeight);

      // 5. Esporta il file elaborato in JPG
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject("Errore generazione Blob");
        },
        "image/jpeg",
        0.92 // Qualità 92%
      );
    };

    img.onload = onLoaded;
    logo.onload = onLoaded;
    img.onerror = reject;
    logo.onerror = reject;
  });
}