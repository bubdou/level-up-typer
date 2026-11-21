import { describe, expect, it } from 'vitest';
import { direction, fingerLine, wrongLine } from './keyboardLayout';

describe('where the key is, in words', () => {
  it('says which way to move from the wrong key', () => {
    expect(direction('t', 'r')).toBe('one key to the left');
    expect(direction('g', 'r')).toBe('one row up and one key to the left');
    expect(direction('e', 'r')).toBe('one key to the right');
    expect(direction('q', 'e')).toBe('two keys to the right');
    expect(direction('r', 'f')).toBe('one row down');
    expect(direction('v', 'r')).toBe('two rows up and one key to the left');
    expect(direction('c', 'e')).toBe('two rows up and one key to the left');
  });

  it('writes the whole line for each kind of miss', () => {
    expect(wrongLine('t', 'r')).toBe('You pressed t. r is one key to the left.');
    expect(wrongLine('5', 'r')).toBe('You pressed 5. Find r.');
    expect(wrongLine('t', ' ')).toBe('You pressed t. Now press space.');
    expect(wrongLine(' ', 'r')).toBe('You pressed space. Find r.');
  });

  it('names the finger, and says when the key is its home key', () => {
    expect(fingerLine('r')).toBe('Left index finger');
    expect(fingerLine('f')).toBe("Left index finger. It's on its home key.");
    expect(fingerLine('p')).toBe('Right pinky');
    expect(fingerLine(' ')).toBe('Thumb on the space bar.');
  });
});
