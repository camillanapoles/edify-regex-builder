declare const acode: {
  setPluginInit(
    id: string,
    cb: (baseUrl: string, $page: HTMLElement | null, cache: { cacheFile?: string; cacheFileUrl?: string }) => void | Promise<void>,
  ): void;
  setPluginUnmount(id: string, cb: () => void): void;
};
