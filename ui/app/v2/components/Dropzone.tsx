'use client';

import { ChangeEvent, DragEvent, useRef, useState } from 'react';

type Props = {
  accept:   string;
  multiple: boolean;
  onAdd:    (files: File[]) => void;
  hint?:    string;
  size?:    'sm' | 'md';
};

export default function Dropzone({ accept, multiple, onAdd, hint, size = 'md' }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onAdd(multiple ? Array.from(e.target.files) : [e.target.files[0]]);
    if (ref.current) ref.current.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDrag(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    onAdd(multiple ? files : [files[0]]);
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[5px] transition-colors"
      style={{
        background:  drag ? 'var(--accent-soft)' : 'var(--surface)',
        border:      drag ? '1px dashed var(--accent)' : '1px dashed var(--line-2)',
        height:      size === 'sm' ? 64 : 90,
        fontSize:    11.5,
        color:       drag ? 'var(--accent)' : 'var(--ink-3)',
      }}
    >
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden" onChange={handleChange} />
      <div className="text-[18px]">↑</div>
      <div>
        {drag ? 'solte para anexar' : <>arraste ou <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>clique para selecionar</span></>}
      </div>
      {hint && <div className="font-mono-ui text-[10px]" style={{ color: 'var(--ink-3)' }}>{hint}</div>}
    </div>
  );
}
