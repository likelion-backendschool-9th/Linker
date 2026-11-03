import { act, renderHook } from '@testing-library/react';

import { useImageUpload } from './use-image-upload';
import { uploadImage } from './upload-image';

vi.mock('./upload-image', async (importOriginal) => ({
  ...await importOriginal<typeof import('./upload-image')>(),
  uploadImage: vi.fn(() => new Promise(() => {})),
}));
beforeEach(() => {
  vi.mocked(uploadImage).mockClear();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:preview');
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => vi.unstubAllGlobals());
const photo = () => new File(['photo'], 'photo.png', { type: 'image/png' });
it('enforces the maximum across selections before React renders', () => {
  const { result } = renderHook(() => useImageUpload(2));
  act(() => {
    result.current.add([photo()]);
    result.current.add([photo(), photo()]);
  });
  expect(result.current.items).toHaveLength(2);
  expect(uploadImage).toHaveBeenCalledTimes(2);
});
it('does not resurrect removed files when a new selection follows reset in the same event', () => {
  const { result } = renderHook(() => useImageUpload(2));
  act(() => result.current.add([photo()]));
  const oldKey = result.current.items[0]!.key;
  act(() => {
    result.current.reset([]);
    result.current.add([photo()]);
  });
  expect(result.current.items).toHaveLength(1);
  expect(result.current.items[0]!.key).not.toBe(oldKey);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
});
