const config = {
  default: {
    override: {
      wrapper: "cloudflare",
      converter: "edge",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
};

export default config;