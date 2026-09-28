import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Lesson, Word } from '../types'

type Overview = { learners: number; words: number; forms: number; sentences: number; lessons: Lesson[] }
type Props = { lessonId: number; onChanged: () => void }

export default function AdminDashboard({ lessonId, onChanged }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [overviewResponse, wordResponse] = await Promise.all([api('admin/overview'), api(`admin/lessons/${lessonId}/words`)])
      if (!overviewResponse.ok || !wordResponse.ok) throw new Error()
      setOverview(await overviewResponse.json())
      setWords(await wordResponse.json())
      setMessage('')
    } catch { setMessage('관리 자료를 불러오지 못했어요. 관리자 권한을 다시 확인해 주세요.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [lessonId])

  const removeWord = async (word: Word) => {
    if (!window.confirm(`‘${word.greek}’ 단어를 삭제할까요? 연결된 변화형과 학습 기록에도 영향을 줄 수 있어요.`)) return
    try {
      const response = await api(`admin/words/${word.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '삭제하지 못했어요.')
      setMessage('단어를 삭제했어요.')
      await load(); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '삭제하지 못했어요.') }
  }

  if (loading) return <section className="panel empty-panel">관리 현황을 불러오고 있어요.</section>
  if (!overview) return <section className="panel empty-panel"><p>{message}</p></section>
  return <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
    <div className="section-heading"><div><p className="eyebrow">관리 대시보드</p><h2 id="admin-dashboard-title">학습장 운영 현황</h2></div><span className="count-badge">관리자</span></div>
    <div className="admin-stats"><article><b>{overview.learners}</b><span>학습자 수</span></article><article><b>{overview.words}</b><span>등록 단어</span></article><article><b>{overview.forms}</b><span>변화형 자료</span></article><article><b>{overview.sentences}</b><span>번역 문제</span></article></div>
    <section className="admin-section"><h3>과별 학습 자료</h3><div className="lesson-summary">{overview.lessons.map(lesson => <span key={lesson.id}>{lesson.name} <b>{lesson.word_count}개</b></span>)}</div></section>
    <section className="admin-section"><div className="admin-section-heading"><div><h3>선택한 과의 단어 관리</h3><p>현재 선택한 과의 단어를 확인하고 삭제할 수 있어요.</p></div><button className="clear-btn" onClick={load}>새로고침</button></div>{words.length ? <ul className="admin-word-list">{words.map(word => <li key={word.id}><div><strong className="greek">{word.greek}</strong><span>{word.pronunciation} · {word.part_of_speech} · {word.meaning}</span></div><button onClick={() => removeWord(word)}>삭제</button></li>)}</ul> : <p className="admin-empty">이 과에는 등록된 단어가 없어요.</p>}</section>
    {message && <p className="admin-message" role="status">{message}</p>}
  </section>
}
