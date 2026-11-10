import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { shouldIgnoreKeyEvent } from '../src/lib/lander/input';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const document = dom.window.document;

describe('Lander Input Guards', () => {
  it('ignores events when metaKey or ctrlKey or altKey is pressed (e.g. Cmd+K or Ctrl+R)', () => {
    expect(
      shouldIgnoreKeyEvent({
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        target: document.createElement('div'),
      } as unknown as KeyboardEvent)
    ).toBe(true);

    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        target: document.createElement('div'),
      } as unknown as KeyboardEvent)
    ).toBe(true);

    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        target: document.createElement('div'),
      } as unknown as KeyboardEvent)
    ).toBe(true);
  });

  it('ignores events when event target is an input, textarea, or select', () => {
    const inputEl = document.createElement('input');
    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: inputEl,
      } as unknown as KeyboardEvent)
    ).toBe(true);

    const textareaEl = document.createElement('textarea');
    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: textareaEl,
      } as unknown as KeyboardEvent)
    ).toBe(true);

    const selectEl = document.createElement('select');
    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: selectEl,
      } as unknown as KeyboardEvent)
    ).toBe(true);
  });

  it('ignores events when event target is contenteditable', () => {
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: div,
      } as unknown as KeyboardEvent)
    ).toBe(true);
  });

  it('permits game keys on canvas or standard body target', () => {
    const canvas = document.createElement('canvas');
    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: canvas,
      } as unknown as KeyboardEvent)
    ).toBe(false);

    expect(
      shouldIgnoreKeyEvent({
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        target: document.body,
      } as unknown as KeyboardEvent)
    ).toBe(false);
  });
});
