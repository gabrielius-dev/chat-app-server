export default function extractFileIdFromDriveUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : "";
}
