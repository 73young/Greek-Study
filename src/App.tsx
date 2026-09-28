import { useEffect, useRef, useState } from 'react'
import { api } from './lib/api'
import type { Lesson, Tab, Word } from './types'
import FlashCard from './components/FlashCard'
import Quiz from './components/Quiz'
import WrongNotes from './components/WrongNotes'
import WordImporter from './components/WordImporter'
import StudyGuide from './components/StudyGuide'
import FormsStudy from './components/FormsStudy'
import PracticeTests from './components/PracticeTests'
import MaterialGuide from './components/MaterialGuide'
import DataConnectionGuide from './components/DataConnectionGuide'
import AdminAccess from './components/AdminAccess'
import AdminDashboard from './components/AdminDashboard'
import GithubUploadGuide from './components/GithubUploadGuide'
const stateKey = 'greek-study-state'
type Screen = Tab | 'admin' | 'github'
type CardState = { lessonId?: number; tab?: Tab; index?: number; flipped?: boolean }
export default function App() {
  const [lessons, setLessons] = useState<Lesson[]>([]); const [lessonId, setLessonId] = useState(1); const [words, setWords] = useState<Word[]>([]); const [tab, setTab] = useState<Screen>('cards'); const [index, setIndex] = useState(0); const [flipped, setFlipped] = useState(false); const [loading, setLoading] = useState(true); const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [wrongRefresh, setWrongRefresh] = useState(0); const [shareMessage, setShareMessage] = useState(''); const [isAdmin, setIsAdmin] = useState(false); const [adminConfigured, setAdminConfigured] = useState(false)
  const restoredCard = useRef<CardState | null>(null)
  const loadLessons = async () => { const res = await api('lessons'); const data: Lesson[] = await res.json(); setLessons(data); return data }
  const loadWords = async (id: number, restoreCard = false) => { setLoading(true); try { const res = await api(`lessons/${id}/words`); if (!res.ok) throw new Error(); const data: Word[] = await res.json(); setWords(data); const saved = restoredCard.current; if (restoreCard && saved) { setIndex(data.length ? Math.min(Math.max(saved.index ?? 0, 0), data.length - 1) : 0); setFlipped(Boolean(saved.flipped) && data.length > 0); restoredCard.current = null } else { setIndex(0); setFlipped(false) } setError('') } catch { setError('학습 단어를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') } finally { setLoading(false) } }
  useEffect(() => { (async () => { try { const stateRes = await api(`state/${stateKey}`); const state = await stateRes.json(); if (state.value) { const saved: CardState = JSON.parse(state.value); restoredCard.current = saved; if (saved.lessonId) setLessonId(saved.lessonId); if (saved.tab) setTab(saved.tab) } await loadLessons() } catch { setError('학습장을 준비하지 못했어요.') } finally { setReady(true) } })() }, [])
  useEffect(() => { if (!ready) return; const saved = restoredCard.current; loadWords(lessonId, Boolean(saved && saved.lessonId === lessonId)) }, [lessonId, ready])
  useEffect(() => { if (!loading && ready) api('state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: stateKey, value: JSON.stringify({ lessonId, tab, index, flipped }) }) }).catch(() => undefined) }, [lessonId, tab, index, flipped, loading, ready])
  const current = words[index]
  const next = (direction: number) => { if (!words.length) return; setIndex(value => (value + direction + words.length) % words.length); setFlipped(false) }
  const refreshWords = async () => { await loadLessons(); await loadWords(lessonId) }
  const shareApp = async () => {
    const shareData = { title: '헬라어 단어 학습장', text: '신약성서 헬라어 단어를 카드와 퀴즈로 학습해 보세요.', url: window.location.href }
    try {
      if (navigator.share) await navigator.share(shareData)
      else { await navigator.clipboard.writeText(window.location.href); setShareMessage('공유 링크를 복사했어요.') }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      try { await navigator.clipboard.writeText(window.location.href); setShareMessage('공유 링크를 복사했어요.') }
      catch { setShareMessage('이 브라우저에서는 링크 복사를 지원하지 않아요.') }
    }
  }
  const selectedLesson = lessons.find(item => item.id === lessonId)
  return <div className="app-shell"><header className="topbar"><div className="brand"><p>NEW TESTAMENT GREEK</p><h1>헬라어 단어 학습장</h1></div><div className="lesson-picker"><label htmlFor="lesson">학습 단원</label><select id="lesson" value={lessonId} onChange={e => setLessonId(Number(e.target.value))}>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.name}</option>)}</select></div><div className="progress-box"><span>{selectedLesson?.word_count ?? 0}개 단어</span><b>{words.length ? `${index + 1} / ${words.length}` : '0 / 0'}</b></div><button className="share-button" onClick={shareApp}>↗ 학습장 공유</button>{shareMessage && <p className="share-message" role="status">{shareMessage}</p>}</header><main><AdminAccess onStatusChange={(admin, configured) => { setIsAdmin(admin); setAdminConfigured(configured); if (!admin && tab === 'admin') setTab('cards') }} /><StudyGuide /><DataConnectionGuide /><nav className="tabs" aria-label="학습 메뉴">{([['cards', '▣ 암기 카드'], ['forms', '⌁ 변화형'], ['quiz', '✦ 단어 퀴즈'], ['tests', '✓ 테스트'], ['wrong', '↗ 오답 노트'], ['github', '⌘ GitHub 올리기'], ...(isAdmin ? [['admin', '⚙ 관리 메뉴']] : [])] as [Screen, string][]).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? 'active' : ''}>{label}</button>)}</nav>{error && <div className="notice error">{error}</div>}{tab === 'cards' && <><section className="study-panel panel"><div className="section-heading"><div><p className="eyebrow">{selectedLesson?.name || '선택 단원'} 암기</p><h2>단어를 눌러 뜻을 확인하세요</h2></div><span className="count-badge">학습 중</span></div>{loading ? <div className="empty-card">단어를 불러오고 있어요.</div> : <><FlashCard word={current} flipped={flipped} onToggle={() => setFlipped(value => !value)} /><div className="card-controls"><button onClick={() => next(-1)} disabled={!words.length}>← 이전 단어</button><span>{words.length ? `${index + 1} / ${words.length}` : '0 / 0'}</span><button onClick={() => next(1)} disabled={!words.length}>다음 단어 →</button></div></>}</section><MaterialGuide onAddWords={() => document.getElementById('word-importer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} /><WordImporter lessonId={lessonId} onAdded={refreshWords} canEdit={isAdmin} configured={adminConfigured} /></>}{tab === 'forms' && <FormsStudy lessonId={lessonId} />}{tab === 'quiz' && <Quiz lessonId={lessonId} words={words} onWrong={() => setWrongRefresh(value => value + 1)} />}{tab === 'tests' && <PracticeTests lessonId={lessonId} />}{tab === 'wrong' && <WrongNotes lessonId={lessonId} refreshKey={wrongRefresh} />}{tab === 'github' && <GithubUploadGuide />}{tab === 'admin' && isAdmin && <AdminDashboard lessonId={lessonId} onChanged={refreshWords} />}</main></div>
}
