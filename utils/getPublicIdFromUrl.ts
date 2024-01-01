const getPublicIdFromUrl = (url: string) => {
  const regex =
    /http:\/\/res.cloudinary.com\/dlrcpfr2p\/image\/upload\/[^/]+\/([^/]+\/[^/]+)\..+/;
  const match = url.match(regex);

  if (match?.[1]) {
    return match[1];
  }
  return "";
};

export default getPublicIdFromUrl;
