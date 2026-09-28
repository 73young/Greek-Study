import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { SentenceTest, WordForm } from '../types'
type Props = { lessonId: number }
type TestMode = 'forms' | 'translation'
type Result = 'correct' | 'wrong' | null
const normalize = (value: string) => value.replace(/\s|[.!?,]/g, '').trim()
export default function PracticeTests({ lessonId }: Props) {
  const [mode, setMode] = useState<TestMode>('forms')
  const [forms, setForms] = useState<WordForm[]>([])
  const [sentences, setSentences] = useState<SentenceTest[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<Result>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setIndex(0); setAnswer(''); setResult(null)
    Promise.all([api(`lessons/${lessonId}/forms`), api(`lessons/${lessonId}/sentences`)])
      .then(async ([formResponse, sentenceResponse]) => {
        if (!formResponse.ok || !sentenceResponse.ok) throw new Error()
        return Promise.all([formResponse.json() as Promise<WordForm[]>, sentenceResponse.json() as Promise<SentenceTest[]>])
      })
      .then(([formData, sentenceData]) => { if (active) { setForms(formData); setSentences(sentenceData) } })
      .catch(() => { if (active) setError('테스트 문제를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [lessonId])
  const items = mode === 'forms' ? forms : sentences
  const item = items[index]
  const title = mode === 'forms' ? '변화형 테스트' : '문장 번역 테스트'
  const prompt = mode === 'forms' && item ? (item as WordForm).form_text : mode === 'translation' && item ? (item as SentenceTest).greek_text : ''
  const correctAnswer = useMemo(() => {
    if (!item) return ''
    return mode === 'forms' ? (item as WordForm).grammar_label : (item as SentenceTest).korean_answer
  }, [item, mode])
  const explanation = mode === 'forms' && item
    ? `${(item as WordForm).greek} · ${(item as WordForm).gloss}`
    : mode === 'translation' && item ? (item as SentenceTest).hint : ''
  const switchMode = (next: TestMode) => { setMode(next); setIndex(0); setAnswer(''); setResult(null) }
  const check = () => {
    if (!answer.trim() || result) return
    setResult(normalize(answer) === normalize(correctAnswer) ? 'correct' : 'wrong')
  }
  const next = () => { if (!items.length) return; setIndex(value => (value + 1) % items.length); setAnswer(''); setResult(null) }
  if (loading) return <section className="panel empty-panel">테스트를 준비하고 있어요.</section>
  if (error) return <section className="panel empty-panel"><p>{error}</p></section>
  if (!items.length) return <section className="panel empty-panel"><p className="eyebrow">테스트</p><h2>아직 준비된 문제가 없어요</h2><p>이 과의 변화형 또는 문장 자료를 추가하면 테스트할 수 있어요.</p></section>
  return <section className="panel test-panel">
    <div className="section-heading"><div><p className="eyebrow">확인 테스트</p><h2>{title}</h2></div><span className="count-badge">{index + 1} / {items.length}</span></div>
    <div className="mode-switch test-switch" aria-label="테스트 유형"><button className={mode === 'forms' ? 'selected' : ''} onClick={() => switchMode('forms')}>변화형</button><button className={mode === 'translation' ? 'selected' : ''} onClick={() => switchMode('translation')}>문장 번역</button></div>
    <div className="test-question"><span>{mode === 'forms' ? '아래 형태의 문법 정보를 입력하세요' : '아래 문장을 한국어로 번역하세요'}</span><strong className="greek">{prompt}</strong>{mode === 'forms' && <p>기본형: {(item as WordForm).greek} · {(item as WordForm).meaning}</p>}</div>
    {mode === 'translation' && item && <p className="source-note">본문 기준: {(item as SentenceTest).source_reference || '출처 정보 없음'}{(item as SentenceTest).source_checked_at ? ` · 확인일 ${(item as SentenceTest).source_checked_at}` : ''}</p>}
    <div className="answer-form"><input value={answer} onChange={event => setAnswer(event.target.value)} onKeyDown={event => event.key === 'Enter' && check()} disabled={!!result} placeholder={mode === 'forms' ? '예) 현재 능동 직설법 2인칭 단수' : '번역을 입력하세요'} /><button className="primary-btn" onClick={check}>답 확인</button></div>
    {result && <div className={`result ${result}`} role="status"><strong>{result === 'correct' ? '✓ 정답이에요!' : '↗ 정답을 확인해 보세요'}</strong><span>정답: <b>{correctAnswer}</b></span><p className="test-explanation">{explanation}</p><button className="next-quiz" onClick={next}>다음 문제 →</button></div>}
  </section>
}
