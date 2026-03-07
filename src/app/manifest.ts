import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ФинПланер",
    short_name: "ФинПланер",
    description: "Кассовый планировщик для ИП и микробизнеса",
    start_url: "/",
    display: "standalone",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
