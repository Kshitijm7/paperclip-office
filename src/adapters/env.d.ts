declare module "*?raw" {
  const text: string;
  export default text;
}
declare module "*?url" {
  const url: string;
  export default url;
}

interface Window {
  cth: {
    hiveTasks: () => Promise<unknown>;
    onHiveMessage?: (
      fn: (e: { from: string; targets: string[]; act: "request"; needsHuman: boolean }) => void,
    ) => () => void;
  };
}
