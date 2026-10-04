declare module "heic-convert/browser.js" {
  export default function convert(options: { buffer: Uint8Array; format: "JPEG" | "PNG"; quality?: number }): Promise<Uint8Array>;
}
