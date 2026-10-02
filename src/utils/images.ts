const cloudinaryBase = "https://res.cloudinary.com/dzq8y9qes/image/upload";

export const resolveImageUrl = (value?: string | null, transform = "") => {
  const image = value?.trim();
  if (!image) {
    return undefined;
  }

  if (/^https?:\/\//.test(image)) {
    return image;
  }

  if (image.startsWith("/")) {
    return image;
  }

  const transformPath = transform ? `${transform.replace(/^\/+|\/+$/g, "")}/` : "";
  return `${cloudinaryBase}/${transformPath}v1/${image}`;
};

export const resolveWorkImageUrls = (value: string) => {
  const isGif = /\.gif$/i.test(value.trim());
  return {
    // Preserve every GIF frame and avoid Cloudinary's animated-image processing limits.
    image: resolveImageUrl(value, isGif ? "" : "w_1920,q_auto,f_auto"),
    thumbnail: resolveImageUrl(value, `${isGif ? "pg_1," : ""}w_600,h_400,c_fill,q_auto,f_auto`)
  };
};
