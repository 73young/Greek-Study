import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Word } from '../types'
import FlashCard from './FlashCard'

type Props = { lessonId: number; refreshKey: number }
export default function WrongNotes({ lessonId, refreshKey }: Props) {
  const [words, setWords] = useState<Word[]>([]); const [index, setIndex] = useState(0); const [flipped, setFlipped] = useState(false); const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const res = await api(`wrong-notes?lesson_id=${lessonId}`); setWords(await res.json()); setIndex(0); setFlipped(false) } finally { setLoading(false) } }
  useEffect(() => { load() }, [lessonId, refreshKey])
  const remove = async () => { const word = words[index]; if (!word) return; await api(`wrong-notes/${word.id}`, { method: 'DELETE' }); setWords(current => current.filter(item => item.id !== word.id)); setIndex(0); setFlipped(false) }
  if (loading) return <section className="panel empty-panel">오답 노트를 불러오고 있어요.</section>
  if (!words.length) return <section className="panel empty-panel"><p className="eyebrow">오답 노트</p><h2>아직 저장된 오답이 없어요</h2><p>퀴즈에서 다시 확인할 단어가 생기면 이곳에 차곡차곡 모아 드릴게요.</p></section>
  const word = words[index]
  return <section className="review-panel panel"><div className="section-heading"><div><p className="eyebrow">오답 노트</p><h2>헷갈린 단어 다시 보기</h2></div><span className="count-badge">{words.length}개 저장됨</span></div><FlashCard word={word} flipped={flipped} onToggle={() => setFlipped(value => !value)} label="카드를 눌러 복습하세요" /><div className="card-controls"><button onClick={() => { setIndex(value => (value - 1 + words.length) % words.length); setFlipped(false) }}>← 이전 단어</button><span>{index + 1} / {words.length}</span><button onClick={() => { setIndex(value => (value + 1) % words.length); setFlipped(false) }}>다음 단어 →</button></div><button className="clear-btn" onClick={remove}>이 단어는 익혔어요 · 오답 노트에서 지우기</button></section>
}
