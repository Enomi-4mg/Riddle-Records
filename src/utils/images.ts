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
