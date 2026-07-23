import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Song } from '../types';
import { API_BASE, deleteSong, fetchSongs, uploadSong } from '../lib/api';
import { useSocket } from '../lib/useSocket';

export function Admin() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lrcText, setLrcText] = useState<string | null>(null);
  const [lrcStatus, setLrcStatus] = useState<'none' | 'searching' | 'found' | 'not_found' | 'manual'>('none');

  // estado da sessão ativa (para mostrar controle de offset só quando há apresentação)
  const [hasActive, setHasActive] = useState(false);
  const [offset, setOffset] = useState(0);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);

  // WebSocket — Admin escuta o estado e envia comando de offset
  const { send } = useSocket((msg) => {
    if (msg.type === 'state') {
      setHasActive(!!msg.active);
      // Reseta offset quando começa nova sessão
      if (!msg.active) setOffset(0);
    }
    if (msg.type === 'session:countdown') {
      setHasActive(true);
      setOffset(0);
    }
    if (msg.type === 'session:end') {
      setHasActive(false);
      setOffset(0);
    }
  });

  useEffect(() => {
    send({ type: 'admin:hello' });
  }, []);

  function handleOffsetChange(newOffset: number) {
    const clamped = Math.max(-10, Math.min(10, newOffset));
    setOffset(clamped);
    send({ type: 'operator:setOffset', offset: clamped });
  }

  async function reload() {
    setLoading(true);
    try {
      setSongs(await fetchSongs());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleSearchLrc() {
    if (!title.trim() || !artist.trim()) {
      setError('Preencha título e artista antes de buscar a letra.');
      return;
    }
    setError(null);
    setLrcStatus('searching');
    setLrcText(null);
    try {
      const params = new URLSearchParams({ title: title.trim(), artist: artist.trim() });
      const res = await fetch(`${API_BASE}/api/songs/search-lrc?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setLrcStatus('not_found');
        setError(data.error ?? 'Letra não encontrada.');
        return;
      }
      setLrcText(data.lrc);
      setLrcStatus('found');
    } catch {
      setLrcStatus('not_found');
      setError('Falha ao buscar letra. Verifique a conexão.');
    }
  }

  async function handleLrcFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setLrcText(text);
    setLrcStatus('manual');
    setError(null);
  }

  async function handleSubmit() {
    setError(null);
    if (!title.trim() || !artist.trim() || !audioFile) {
      setError('Título, artista e arquivo de áudio são obrigatórios.');
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('artist', artist.trim());
      form.append('audio', audioFile);
      if (lrcText) {
        const blob = new Blob([lrcText], { type: 'text/plain' });
        form.append('lrc', blob, 'lyrics.lrc');
      }
      await uploadSong(form);
      setTitle('');
      setArtist('');
      setAudioFile(null);
      setLrcText(null);
      setLrcStatus('none');
      if (audioInputRef.current) audioInputRef.current.value = '';
      if (lrcInputRef.current) lrcInputRef.current.value = '';
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar música.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteSong(id);
    await reload();
  }

  const lrcBadge = {
    none: null,
    searching: <span className="text-xs text-white/40 animate-pulse">Buscando...</span>,
    found: <span className="text-xs text-emerald-400">✓ Letra sincronizada encontrada</span>,
    not_found: <span className="text-xs text-red-400">Letra não encontrada na LRCLIB</span>,
    manual: <span className="text-xs text-cyan-400">✓ Letra carregada manualmente</span>,
  }[lrcStatus];

  return (
    <div className="min-h-dvh px-6 py-8 max-w-2xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel administrativo</h1>
        <Link to="/" className="text-sm text-fuchsia-300 underline">
          Tela principal
        </Link>
      </div>

      {/* Controle de sincronia — aparece só durante apresentação ativa */}
      {hasActive && (
        <section className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-amber-300">Sincronia da letra</h2>
              <p className="text-xs text-white/40 mt-0.5">
                Ajuste se a letra estiver adiantada ou atrasada em relação ao áudio
              </p>
            </div>
            <span className="text-2xl font-extrabold tabular-nums text-amber-300">
              {offset > 0 ? `+${offset.toFixed(1)}s` : `${offset.toFixed(1)}s`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOffsetChange(offset - 0.5)}
              className="flex-1 rounded-lg py-3 font-bold text-lg bg-white/10 hover:bg-white/15 active:scale-95 transition"
            >
              − 0,5s
            </button>
            <button
              onClick={() => handleOffsetChange(offset - 0.1)}
              className="flex-1 rounded-lg py-3 font-bold bg-white/10 hover:bg-white/15 active:scale-95 transition"
            >
              − 0,1s
            </button>
            <button
              onClick={() => handleOffsetChange(0)}
              disabled={offset === 0}
              className="px-4 rounded-lg py-3 text-xs text-white/40 bg-white/5 hover:bg-white/10 disabled:opacity-30 active:scale-95 transition"
            >
              reset
            </button>
            <button
              onClick={() => handleOffsetChange(offset + 0.1)}
              className="flex-1 rounded-lg py-3 font-bold bg-white/10 hover:bg-white/15 active:scale-95 transition"
            >
              + 0,1s
            </button>
            <button
              onClick={() => handleOffsetChange(offset + 0.5)}
              className="flex-1 rounded-lg py-3 font-bold text-lg bg-white/10 hover:bg-white/15 active:scale-95 transition"
            >
              + 0,5s
            </button>
          </div>

          <p className="text-xs text-white/30 text-center">
            Letra atrasada → pressione <strong>+</strong> · Letra adiantada → pressione <strong>−</strong>
          </p>
        </section>
      )}

      {/* Cadastrar música */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="font-semibold">Cadastrar música</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setLrcStatus('none'); setLrcText(null); }}
            placeholder="Título *"
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-fuchsia-400/60"
          />
          <input
            value={artist}
            onChange={(e) => { setArtist(e.target.value); setLrcStatus('none'); setLrcText(null); }}
            placeholder="Artista *"
            className="bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 outline-none focus:border-fuchsia-400/60"
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-white/50">Áudio (mp3/wav/ogg) *</span>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>

        <div className="flex flex-col gap-2 bg-black/20 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-white/50">Letra sincronizada</span>
            {lrcBadge}
          </div>
          <button
            type="button"
            onClick={handleSearchLrc}
            disabled={lrcStatus === 'searching' || !title.trim() || !artist.trim()}
            className="rounded-lg py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 disabled:opacity-30 active:scale-[0.98] transition"
          >
            {lrcStatus === 'searching' ? 'Buscando na LRCLIB...' : 'Buscar letra automaticamente'}
          </button>
          <div className="flex items-center gap-3 text-white/30 text-xs">
            <div className="flex-1 h-px bg-white/10" />
            ou faça upload manual
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <input
            ref={lrcInputRef}
            type="file"
            accept=".lrc,text/plain"
            onChange={(e) => handleLrcFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          {lrcText && (
            <details className="mt-1">
              <summary className="text-xs text-white/30 cursor-pointer select-none">
                Prévia da letra ({lrcText.split('\n').length} linhas)
              </summary>
              <pre className="mt-2 text-xs text-white/40 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {lrcText.slice(0, 500)}{lrcText.length > 500 ? '\n...' : ''}
              </pre>
            </details>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !audioFile || !title.trim() || !artist.trim()}
          className="rounded-lg py-3 font-semibold bg-gradient-to-r from-fuchsia-500 to-cyan-500 disabled:opacity-30 active:scale-[0.98] transition"
        >
          {submitting ? 'Enviando...' : 'Adicionar música'}
        </button>
      </section>

      {/* Biblioteca */}
      <section>
        <h2 className="font-semibold mb-3">
          Biblioteca ({loading ? '...' : songs.length})
        </h2>
        <div className="flex flex-col gap-2">
          {songs.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3"
            >
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-white/40">
                  {s.artist} · {s.lrcUrl ? '🎵 letra sincronizada' : 'sem letra'}
                </p>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-xs text-red-400 hover:text-red-300 ml-4 shrink-0"
              >
                Remover
              </button>
            </div>
          ))}
          {!loading && songs.length === 0 && (
            <p className="text-white/30 text-sm">Nenhuma música cadastrada ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}