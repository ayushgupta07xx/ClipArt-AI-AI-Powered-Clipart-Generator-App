import { StyleId } from '../constants';

interface StoredImage {
  base64: string;
  mimeType: string;
  uri: string;
  promptSuffix: string;
  strengthRatio: number;
  selectedStyleId?: StyleId;
}

let _image: StoredImage | null = null;

export const imageStore = {
  get: (): StoredImage | null => _image,
  set: (img: StoredImage) => { _image = img; },
  clear: () => { _image = null; },
};
