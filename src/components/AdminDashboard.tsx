import { FormEvent, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Lesson, Word, WordForm } from '../types'
type Overview = { learners: number; words: number; forms: number; sentences: number; lessons: Lesson[] }
type Props = { lessonId: number; onChanged: () => void; onLessonSelected: (lessonId: number) => void }
type WordDraft = Pick<Word, 'greek' | 'pronunciation' | 'part_of_speech' | 'meaning'>
type FormDraft = { word_id: number; form_text: string; grammar_label: string; gloss: string }
const draftOf = (word: Word): WordDraft => ({ greek: word.greek, pronunciation: word.pronunciation, part_of_speech: word.part_of_speech, meaning: word.meaning })
export default function AdminDashboard({ lessonId, onChanged, onLessonSelected }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [forms, setForms] = useState<WordForm[]>([])
  const [lessonName, setLessonName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [editedLessonName, setEditedLessonName] = useState('')
  const [editingWordId, setEditingWordId] = useState<number | null>(null)
  const [wordDraft, setWordDraft] = useState<WordDraft | null>(null)
  const [formDraft, setFormDraft] = useState<FormDraft>({ word_id: 0, form_text: '', grammar_label: '', gloss: '' })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const selectedLesson = overview?.lessons.find(lesson => lesson.id === lessonId)
  const load = async () => {
    setLoading(true)
    try {
      const [overviewResponse, wordResponse, formResponse] = await Promise.all([api('admin/overview'), api(`admin/lessons/${lessonId}/words`), api(`lessons/${lessonId}/forms`)])
      if (!overviewResponse.ok || !wordResponse.ok || !formResponse.ok) throw new Error()
      const nextWords = await wordResponse.json() as Word[]
      setOverview(await overviewResponse.json()); setWords(nextWords); setForms(await formResponse.json())
      setFormDraft(current => ({ ...current, word_id: nextWords.some(word => word.id === current.word_id) ? current.word_id : (nextWords[0]?.id || 0) }))
    } catch { setMessage('관리 자료를 불러오지 못했어요. 관리자 권한을 다시 확인해 주세요.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [lessonId])
  const addLesson = async (event: FormEvent) => {
    event.preventDefault(); const name = lessonName.trim()
    if (!name) { setMessage('새 과의 이름을 입력해 주세요.'); return }
    try {
      const response = await api('admin/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '새 과를 만들지 못했어요.')
      setLessonName(''); setMessage(`‘${data.name}’을 만들었어요.`); onLessonSelected(data.id); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '새 과를 만들지 못했어요.') }
  }
  const selectLesson = (id: number) => { setRenaming(false); setEditingWordId(null); setWordDraft(null); setMessage(''); onLessonSelected(id) }
  const moveLesson = async (direction: number) => {
    if (!overview) return
    const list = [...overview.lessons]; const index = list.findIndex(lesson => lesson.id === lessonId); const target = index + direction
    if (index < 0 || target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    setOverview({ ...overview, lessons: list })
    try {
      const response = await api('admin/lessons/order', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lesson_ids: list.map(lesson => lesson.id) }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || '과 순서를 바꾸지 못했어요.')
      setMessage('과 순서를 저장했어요. 기존 단어와 변화형은 그대로 유지됩니다.'); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '과 순서를 바꾸지 못했어요.'); load() }
  }
  const saveLessonName = async (event: FormEvent) => {
    event.preventDefault(); const name = editedLessonName.trim()
    if (!name) { setMessage('과 이름을 입력해 주세요.'); return }
    try {
      const response = await api(`admin/lessons/${lessonId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '과 이름을 수정하지 못했어요.')
      setRenaming(false); setOverview(current => current ? { ...current, lessons: current.lessons.map(lesson => lesson.id === data.id ? { ...lesson, ...data } : lesson) } : current); setMessage(`과 이름을 ‘${data.name}’으로 수정했어요.`); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '과 이름을 수정하지 못했어요.') }
  }
  const saveWord = async (event: FormEvent) => {
    event.preventDefault(); if (!wordDraft || editingWordId === null) return
    if (!Object.values(wordDraft).every(value => value.trim())) { setMessage('헬라어, 발음, 품사, 뜻을 모두 입력해 주세요.'); return }
    try {
      const response = await api(`admin/words/${editingWordId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(wordDraft) }); const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '단어를 수정하지 못했어요.')
      setEditingWordId(null); setWordDraft(null); setMessage(`‘${data.greek}’ 단어를 수정했어요.`); await load(); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '단어를 수정하지 못했어요.') }
  }
  const addForm = async (event: FormEvent) => {
    event.preventDefault()
    if (!formDraft.word_id || !formDraft.form_text.trim() || !formDraft.grammar_label.trim()) { setMessage('기본 단어, 변화형 표기, 문법 정보를 입력해 주세요.'); return }
    try {
      const response = await api('admin/forms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formDraft) }); const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '변화형을 추가하지 못했어요.')
      setFormDraft(current => ({ ...current, form_text: '', grammar_label: '', gloss: '' })); setMessage(`‘${data.form_text}’ 변화형을 추가했어요.`); await load(); onChanged()
    } catch (error) { setMessage(error instanceof Error ? error.message : '변화형을 추가하지 못했어요.') }
  }
  const removeForm = async (form: WordForm) => {
    if (!window.confirm(`‘${form.form_text}’ 변화형을 삭제할까요?`)) return
    try { const response = await api(`admin/forms/${form.id}`, { method: 'DELETE' }); const data = await response.json(); if (!response.ok) throw new Error(data.detail || '삭제하지 못했어요.'); setMessage('변화형을 삭제했어요.'); await load(); onChanged() } catch (error) { setMessage(error instanceof Error ? error.message : '변화형을 삭제하지 못했어요.') }
  }
  if (loading) return <section className="panel empty-panel">관리 현황을 불러오고 있어요.</section>
  if (!overview) return <section className="panel empty-panel"><p>{message}</p></section>
  return <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
    <div className="section-heading"><div><p className="eyebrow">관리 대시보드</p><h2 id="admin-dashboard-title">학습장 운영 현황</h2></div><span className="count-badge">관리자</span></div>
    <div className="admin-stats"><article><b>{overview.learners}</b><span>학습자 수</span></article><article><b>{overview.words}</b><span>등록 단어</span></article><article><b>{overview.forms}</b><span>변화형 자료</span></article><article><b>{overview.sentences}</b><span>번역 문제</span></article></div>
    <section className="admin-section"><h3>새 과 만들기</h3><p>예: 4과, 복습 단어, 요한복음 1장</p><form className="lesson-create-form" onSubmit={addLesson}><label htmlFor="new-lesson">과 이름</label><div><input id="new-lesson" value={lessonName} onChange={event => setLessonName(event.target.value)} maxLength={40} placeholder="새 과 이름 입력" /><button className="primary-btn">과 만들기</button></div></form></section>
    <section className="admin-section"><h3>과별 학습 자료</h3><div className="lesson-summary">{overview.lessons.map(lesson => <button key={lesson.id} className={lesson.id === lessonId ? 'selected-lesson' : ''} onClick={() => selectLesson(lesson.id)}>{lesson.name} <b>{lesson.word_count}개</b></button>)}</div></section>
    <section className="admin-section"><div className="admin-section-heading"><div><h3>선택한 과 관리</h3><p>{selectedLesson ? `현재 ‘${selectedLesson.name}’을 관리하고 있어요.` : '선택한 과를 관리할 수 있어요.'}</p></div><button className="clear-btn" onClick={load}>새로고침</button></div><div className="lesson-order-actions"><button className="outline-btn" onClick={() => moveLesson(-1)} disabled={overview.lessons[0]?.id === lessonId}>↑ 앞으로</button><button className="outline-btn" onClick={() => moveLesson(1)} disabled={overview.lessons[overview.lessons.length - 1]?.id === lessonId}>↓ 뒤로</button></div>{renaming ? <form className="inline-edit-form" onSubmit={saveLessonName}><label htmlFor="edit-lesson">과 이름</label><div><input id="edit-lesson" value={editedLessonName} onChange={event => setEditedLessonName(event.target.value)} maxLength={40} autoFocus /><button className="primary-btn">이름 저장</button><button type="button" className="clear-btn" onClick={() => setRenaming(false)}>취소</button></div></form> : <button className="outline-btn" onClick={() => { setEditedLessonName(selectedLesson?.name || ''); setRenaming(true); setMessage('') }}>선택한 과 이름 수정</button>}</section>
    <section className="admin-section"><div className="admin-section-heading"><div><h3>변화형 추가</h3><p>등록한 변화형은 변화형 학습과 변화형 테스트에 바로 사용됩니다.</p></div></div>{words.length ? <form className="form-create-form" onSubmit={addForm}><label>기본 단어<select value={formDraft.word_id} onChange={event => setFormDraft({ ...formDraft, word_id: Number(event.target.value) })}>{words.map(word => <option value={word.id} key={word.id}>{word.greek} · {word.meaning}</option>)}</select></label><label>변화형 표기<input lang="el" value={formDraft.form_text} onChange={event => setFormDraft({ ...formDraft, form_text: event.target.value })} placeholder="예) ἀκούεις" /></label><label>문법 정보<input value={formDraft.grammar_label} onChange={event => setFormDraft({ ...formDraft, grammar_label: event.target.value })} placeholder="예) 현재 능동 직설법 2인칭 단수" /></label><label>뜻 · 풀이 <em>(선택)</em><input value={formDraft.gloss} onChange={event => setFormDraft({ ...formDraft, gloss: event.target.value })} placeholder="예) 너는 듣는다" /></label><button className="primary-btn">변화형 추가</button></form> : <p className="admin-empty">먼저 이 과에 기본 단어를 추가하면 변화형을 연결할 수 있어요.</p>}{forms.length ? <ul className="form-list">{forms.map(form => <li key={form.id}><div><strong className="greek">{form.form_text}</strong><span>{form.greek} · {form.grammar_label}{form.gloss ? ` · ${form.gloss}` : ''}</span></div><button onClick={() => removeForm(form)}>삭제</button></li>)}</ul> : <p className="admin-empty">아직 등록된 변화형이 없어요.</p>}</section>
    <section className="admin-section"><div className="admin-section-heading"><div><h3>선택한 과의 단어 관리</h3><p>단어의 헬라어 표기, 발음, 품사, 뜻을 수정할 수 있어요.</p></div></div>{words.length ? <ul className="admin-word-list">{words.map(word => <li key={word.id}>{editingWordId === word.id && wordDraft ? <form className="word-edit-form" onSubmit={saveWord}><label>헬라어<input value={wordDraft.greek} onChange={event => setWordDraft({ ...wordDraft, greek: event.target.value })} /></label><label>발음<input value={wordDraft.pronunciation} onChange={event => setWordDraft({ ...wordDraft, pronunciation: event.target.value })} /></label><label>품사<input value={wordDraft.part_of_speech} onChange={event => setWordDraft({ ...wordDraft, part_of_speech: event.target.value })} /></label><label>뜻<input value={wordDraft.meaning} onChange={event => setWordDraft({ ...wordDraft, meaning: event.target.value })} /></label><div className="word-edit-actions"><button className="primary-btn">저장</button><button type="button" className="clear-btn" onClick={() => { setEditingWordId(null); setWordDraft(null) }}>취소</button></div></form> : <><div><strong className="greek">{word.greek}</strong><span>{word.pronunciation} · {word.part_of_speech} · {word.meaning}</span></div><div className="word-list-actions"><button className="outline-btn" onClick={() => { setEditingWordId(word.id); setWordDraft(draftOf(word)); setMessage('') }}>수정</button></div></>}</li>)}</ul> : <p className="admin-empty">이 과에는 등록된 단어가 없어요. 암기 카드 탭의 단어 입력 영역에서 바로 추가해 보세요.</p>}</section>
    {message && <p className="admin-message" role="status">{message}</p>}
  </section>
}
