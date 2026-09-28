import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { WordForm } from '../types'
type Props = { lessonId: number }

const speakGreek = (text: string) => {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'el-GR'
  utterance.rate = 0.78
  window.speechSynthesis.speak(utterance)
  return true
}

export default function FormsStudy({ lessonId }: Props) {
  const [forms, setForms] = useState<WordForm[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [speechMessage, setSpeechMessage] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setRevealed(false)
    setSpeechMessage('')
    api(`lessons/${lessonId}/forms`).then(async response => {
      if (!response.ok) throw new Error()
      return response.json() as Promise<WordForm[]>
    }).then(data => {
      if (!active) return
      setForms(data)
      setIndex(0)
    }).catch(() => {
      if (active) setError('변화형을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false; if ('speechSynthesis' in window) window.speechSynthesis.cancel() }
  }, [lessonId])
  const current = forms[index]
  const move = (direction: number) => {
    if (!forms.length) return
    setIndex(value => (value + direction + forms.length) % forms.length)
    setRevealed(false)
    setSpeechMessage('')
  }
  const readForm = () => setSpeechMessage(speakGreek(current.form_text) ? `‘${current.form_text}’을 읽고 있어요.` : '이 브라우저에서는 읽기 기능을 지원하지 않아요.')
  if (loading) return <section className="panel empty-panel">변화형을 불러오고 있어요.</section>
  if (error) return <section className="panel empty-panel"><p>{error}</p></section>
  if (!current) return <section className="panel empty-panel"><p className="eyebrow">변화형 학습</p><h2>아직 등록된 변화형이 없어요</h2><p>현재는 기본 단어를 먼저 익혀 보세요.</p></section>
  return <section className="panel forms-panel">
    <div className="section-heading">
      <div><p className="eyebrow">변화형 학습</p><h2>형태와 문법을 함께 익히세요</h2></div>
      <span className="count-badge">{index + 1} / {forms.length}</span>
    </div>
    <button className={`form-card ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed(value => !value)} aria-label="변화형 풀이 보기">
      <span className="form-card-label">기본형 · {current.greek} · {current.meaning}</span>
      <strong className="greek">{current.form_text}</strong>
      {revealed ? <span className="form-answer"><b>{current.grammar_label}</b><em>{current.gloss || '뜻을 문맥에서 확인해 보세요.'}</em></span> : <span className="form-prompt">카드를 눌러 문법 정보와 뜻을 확인하세요</span>}
    </button>
    <div className="speech-tools"><button type="button" className="speech-button" onClick={readForm} aria-label={`${current.form_text} 읽기`}>🔊 변화형 읽기</button><span role="status" aria-live="polite">{speechMessage}</span></div>
    <div className="card-controls"><button onClick={() => move(-1)}>← 이전 변화형</button><span>{index + 1} / {forms.length}</span><button onClick={() => move(1)}>다음 변화형 →</button></div>
    <p className="form-note">기본형을 먼저 보고 변화된 형태의 인칭·격을 떠올려 보세요.</p>
  </section>
}
