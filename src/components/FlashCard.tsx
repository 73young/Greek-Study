import { useEffect, useState } from 'react'
import type { Word } from '../types'
type Props = { word?: Word; flipped: boolean; onToggle: () => void; label?: string }
export default function FlashCard({ word, flipped, onToggle, label }: Props) {
  const [animating, setAnimating] = useState(false)
  useEffect(() => {
    setAnimating(false)
  }, [word?.id])
  if (!word) return <div className="empty-card">이 과에는 아직 단어가 없어요.<br />아래 입력창에서 단어장을 추가해 보세요.</div>
  const toggle = () => { setAnimating(true); onToggle() }
  return <div className="flashcard-wrap">
    <button className={`flashcard ${flipped ? 'is-flipped' : ''} ${animating ? 'is-turning' : ''}`} onClick={toggle} aria-label="카드 앞뒤 보기">
      <span className="card-inner">
        <span className="card-face card-front"><small>{label || '카드를 눌러 뜻을 확인하세요'}</small><strong className="greek">{word.greek}</strong><span>단어 앞면</span></span>
        <span className="card-face card-back"><strong>{word.meaning}</strong><dl aria-label="단어 정보"><div><dd>{word.part_of_speech}</dd></div><div><dd>{word.pronunciation}</dd></div></dl></span>
      </span>
    </button>
  </div>
}
