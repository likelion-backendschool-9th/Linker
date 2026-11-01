import { linkify } from './linkify';

describe('linkify', () => {
  it('splits https links out of plain text and keeps trailing punctuation as text', () => {
    expect(linkify('데모: https://linker.example.dev/app. 확인해 주세요')).toEqual([
      { kind: 'text', value: '데모: ' },
      { kind: 'link', value: 'https://linker.example.dev/app' },
      { kind: 'text', value: '. 확인해 주세요' },
    ]);
  });

  it('leaves http and text without links alone', () => {
    expect(linkify('http://old.example 그대로')).toEqual([
      { kind: 'text', value: 'http://old.example 그대로' },
    ]);
  });
});
