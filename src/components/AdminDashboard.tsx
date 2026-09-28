import { FormEvent, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Lesson, Word } from '../types'
type Overview = { learners: number; words: number; forms: number; sentences: number; lessons: Lesson[] }
type Props = { lessonId: number; onChanged: () => void; onLessonCreated: (lessonId: number) => void }
export default function AdminDashboard({ lessonId, onChanged, onLessonCreated }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [lessonName, setLessonName] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const [overviewResponse, wordResponse] = await Promise.all([api('admin/overview'), api(`admin/lessons/${lessonId}/words`)])
      if (!overviewResponse.ok || !wordResponse.ok) throw new Error()
      setOverview(await overviewResponse.json())
      setWords(await wordResponse.json())
    } catch { setMessage('관리 자료를 불러오지 못했어요. 관리자 권한을 다시 확인해 주세요.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [lessonId])
  const addLesson = async (event: FormEvent) => {
    event.preventDefault()
    if (!lessonName.trim()) { setMessage('새 과의 이름을 입력해 주세요.'); return }
    try {
      const response = await api('admin/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: lessonName }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '새 과를 만들지 못했어요.')
      setLessonName(''); setMessage(`‘${data.name}’을 만들었어요. 이제 이 과에 단어를 추가할 수 있어요.`)
      onLessonCreated(data.id); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '새 과를 만들지 못했어요.') }
  }
  const removeWord = async (word: Word) => {
    if (!window.confirm(`‘${word.greek}’ 단어를 삭제할까요? 연결된 변화형과 학습 기록에도 영향을 줄 수 있어요.`)) return
    try {
      const response = await api(`admin/words/${word.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '삭제하지 못했어요.')
      setMessage('단어를 삭제했어요.'); await load(); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '삭제하지 못했어요.') }
  }
  if (loading) return <section className="panel empty-panel">관리 현황을 불러오고 있어요.</section>
  if (!overview) return <section className="panel empty-panel"><p>{message}</p></section>
  return <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
    <div className="section-heading"><div><p className="eyebrow">관리 대시보드</p><h2 id="admin-dashboard-title">학습장 운영 현황</h2></div><span className="count-badge">관리자</span></div>
    <div className="admin-stats"><article><b>{overview.learners}</b><span>학습자 수</span></article><article><b>{overview.words}</b><span>등록 단어</span></article><article><b>{overview.forms}</b><span>변화형 자료</span></article><article><b>{overview.sentences}</b><span>번역 문제</span></article></div>
    <section className="admin-section"><h3>새 과 만들기</h3><p>예: 4과, 복습 단어, 요한복음 1장</p><form className="lesson-create-form" onSubmit={addLesson}><label htmlFor="new-lesson">과 이름</label><div><input id="new-lesson" value={lessonName} onChange={event => setLessonName(event.target.value)} maxLength={40} placeholder="새 과 이름 입력" /><button className="primary-btn">과 만들기</button></div></form></section>
    <section className="admin-section"><h3>과별 학습 자료</h3><div className="lesson-summary">{overview.lessons.map(lesson => <button key={lesson.id} className={lesson.id === lessonId ? 'selected-lesson' : ''} onClick={() => onLessonCreated(lesson.id)}>{lesson.name} <b>{lesson.word_count}개</b></button>)}</div></section>
    <section className="admin-section"><div className="admin-section-heading"><div><h3>선택한 과의 단어 관리</h3><p>위 과 목록에서 고른 과의 단어를 확인하거나, 암기 카드 탭에서 새 단어를 추가할 수 있어요.</p></div><button className="clear-btn" onClick={load}>새로고침</button></div>{words.length ? <ul className="admin-word-list">{words.map(word => <li key={word.id}><div><strong className="greek">{word.greek}</strong><span>{word.pronunciation} · {word.part_of_speech} · {word.meaning}</span></div><button onClick={() => removeWord(word)}>삭제</button></li>)}</ul> : <p className="admin-empty">이 과에는 등록된 단어가 없어요. 암기 카드 탭의 단어 입력 영역에서 바로 추가해 보세요.</p>}</section>
    {message && <p className="admin-message" role="status">{message}</p>}
  </section>
}
