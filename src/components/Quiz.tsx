import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Word } from '../types'
import FlashCard from './FlashCard'

type Props = { lessonId: number; words: Word[]; onWrong: (word: Word) => void }
type Mode = 'choice' | 'input'
type Result = 'correct' | 'wrong' | null
type QuizState = { mode?: Mode; index?: number; answer?: string; result?: Result }

export default function Quiz({ lessonId, words, onWrong }: Props) {
  const [mode, setMode] = useState<Mode>('choice')
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<Result>(null)
  const [reviewFlipped, setReviewFlipped] = useState(false)
  const [restored, setRestored] = useState(false)
  const word = words[index % Math.max(words.length, 1)]
  const stateKey = `greek-quiz-state-${lessonId}`

  const options = useMemo(() => {
    if (!word) return []
    const distractors = words.filter(item => item.id !== word.id).map(item => item.meaning)
    const filledDistractors = Array.from({ length: 3 }, (_, position) => distractors[position % distractors.length] || '다른 뜻을 확인해 보세요')
    return [word.meaning, ...filledDistractors]
      .map((meaning, position) => ({ meaning, position }))
      .sort((a, b) => `${a.meaning}${word.id}`.localeCompare(`${b.meaning}${word.id}`) || a.position - b.position)
  }, [word, words])

  useEffect(() => {
    let active = true
    setRestored(false)
    setReviewFlipped(false)
    if (!words.length) { setIndex(0); setAnswer(''); setResult(null); setRestored(true); return }
    api(`state/${stateKey}`).then(res => res.json()).then(data => {
      if (!active) return
      const saved: QuizState = data.value ? JSON.parse(data.value) : {}
      setMode(saved.mode === 'input' ? 'input' : 'choice')
      setIndex(Number.isInteger(saved.index) ? Math.min(Math.max(saved.index as number, 0), words.length - 1) : 0)
      setAnswer(typeof saved.answer === 'string' ? saved.answer : '')
      setResult(saved.result === 'correct' || saved.result === 'wrong' ? saved.result : null)
    }).catch(() => {
      if (active) { setIndex(0); setAnswer(''); setResult(null) }
    }).finally(() => { if (active) setRestored(true) })
    return () => { active = false }
  }, [lessonId, words, stateKey])

  useEffect(() => {
    if (!restored) return
    api('state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: stateKey, value: JSON.stringify({ mode, index, answer, result }) }) }).catch(() => undefined)
  }, [mode, index, answer, result, restored, stateKey])

  const selectMode = (nextMode: Mode) => { setMode(nextMode); setAnswer(''); setResult(null); setReviewFlipped(false) }
  const check = async (value?: string) => {
    if (!word || result) return
    const submitted = (value ?? answer).trim()
    if (!submitted) return
    const correct = submitted.replace(/\s/g, '') === word.meaning.replace(/\s/g, '')
    setAnswer(submitted); setResult(correct ? 'correct' : 'wrong')
    if (!correct) { await api(`wrong-notes/${word.id}`, { method: 'POST' }); onWrong(word) }
  }
  const next = () => { setIndex(value => (value + 1) % words.length); setAnswer(''); setResult(null); setReviewFlipped(false) }
  if (!word) return <section className="panel empty-panel"><h2>퀴즈를 만들 단어가 없어요</h2><p>먼저 선택한 과에 단어를 추가해 주세요.</p></section>
  return <section className="quiz-panel panel"><div className="section-heading"><div><p className="eyebrow">자동 생성 퀴즈</p><h2>뜻을 떠올려 보세요</h2></div><div className="mode-switch" aria-label="퀴즈 방식"><button className={mode === 'choice' ? 'selected' : ''} onClick={() => selectMode('choice')}>객관식</button><button className={mode === 'input' ? 'selected' : ''} onClick={() => selectMode('input')}>주관식</button></div></div><div className="question"><span>문제 {index + 1} / {words.length}</span><strong className="greek">{word.greek}</strong><p>{mode === 'choice' ? '알맞은 한국어 뜻을 골라 주세요.' : '한국어 뜻을 직접 입력해 주세요.'}</p></div>{mode === 'choice' ? <div className="options">{options.map(option => <button key={`${option.meaning}-${option.position}`} onClick={() => check(option.meaning)} disabled={!!result} className={result ? (option.meaning === word.meaning ? 'correct-option' : option.meaning === answer ? 'wrong-option' : '') : ''}>{option.meaning}</button>)}</div> : <div className="answer-form"><input value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} placeholder="뜻을 입력하세요" disabled={!!result} /><button className="primary-btn" onClick={() => check()}>정답 확인</button></div>}{result && <div className={`result ${result}`} role="status"><strong>{result === 'correct' ? '✓ 정답이에요!' : '↗ 다시 복습해 볼까요?'}</strong><span>정답: <b>{word.meaning}</b></span>{result === 'wrong' && <div className="instant-review"><p>오답 노트에 저장했어요. 카드를 눌러 다시 확인하세요.</p><FlashCard word={word} flipped={reviewFlipped} onToggle={() => setReviewFlipped(value => !value)} label="즉시 복습 카드" /></div>}<button className="next-quiz" onClick={next}>다음 문제 →</button></div>}</section>
}
