import { useEffect, useRef, useState } from 'react';

export const AUDIO_ACCEPT = '.mp3,.wav,.aiff,.aif,.m4a,.ogg,.flac';
const AUDIO_EXT = /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i;

/** Window-wide drag-and-drop for audio files while `enabled` (the library screen). */
export function useFileDrop(enabled: boolean, onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false);
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  useEffect(() => {
    if (!enabled) return;
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes('Files');
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = Array.from(event.dataTransfer?.files || []).find((item) => AUDIO_EXT.test(item.name));
      if (file) onFileRef.current(file);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      setDragging(false);
    };
  }, [enabled]);

  return dragging;
}
