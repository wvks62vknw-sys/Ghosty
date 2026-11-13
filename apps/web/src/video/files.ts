/** What counts as a video file (by its type, or its name where the phone gives no type), and the files handed to the editor. */
export const isVideoFile = (f: { name: string; type: string }): boolean => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name);
let handed: File[] = [];
export const handTo = (files: File[]): void => {
  handed.push(...files);
};
export const takeHanded = (): File[] => {
  const f = handed;
  handed = [];
  return f;
};
