const sharp = require("sharp");

export default async function resizeAndCompressImage(image: Buffer) {
  const compressedImageBuffer = await sharp(image)
    .resize(50, 50)
    .jpeg({ quality: 100 })
    .toBuffer();
  return compressedImageBuffer;
}
