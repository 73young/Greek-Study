import { useState } from 'react'
import { api } from '../lib/api'
import type { Word } from '../types'

type Props = { lessonId: number; onAdded: () => void; canEdit: boolean; configured: boolean }
type Parsed = Omit<Word, 'id' | 'lesson_id'>
function parseWords(text: string): Parsed[] {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('단어장 내용을 붙여 넣어 주세요.')
  if (trimmed.startsWith('[')) {
    const data: unknown = JSON.parse(trimmed)
    if (!Array.isArray(data)) throw new Error('JSON은 단어 목록 배열이어야 합니다.')
    return data.map((item, i) => {
      const row = item as Record<string, unknown>
      return validate({ greek: String(row.greek || ''), pronunciation: String(row.pronunciation || ''), part_of_speech: String(row.part_of_speech || row.partOfSpeech || ''), meaning: String(row.meaning || '') }, i + 1)
    })
  }
  return trimmed.split(/\r?\n/).filter(Boolean).map((line, i) => {
    const values = line.split(',').map(value => value.trim())
    if (values.length !== 4) throw new Error(`${i + 1}번째 줄은 쉼표로 구분한 4개 항목이어야 합니다.`)
    return validate({ greek: values[0], pronunciation: values[1], part_of_speech: values[2], meaning: values[3] }, i + 1)
  })
}
function validate(word: Parsed, line: number) {
  if (!word.greek || !word.pronunciation || !word.part_of_speech || !word.meaning) throw new Error(`${line}번째 단어의 필수 항목이 비어 있어요.`)
  return word
}
export default function WordImporter({ lessonId, onAdded, canEdit, configured }: Props) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const submit = async () => {
    try {
      const words = parseWords(text)
      const res = await api(`lessons/${lessonId}/words`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '저장하지 못했어요.')
      setMessage(`${data.added}개 단어를 추가했어요. 같은 헬라어 표기는 건너뛰었어요.`); setIsError(false); setText(''); onAdded()
    } catch (error) { setMessage(error instanceof Error ? error.message : '형식을 다시 확인해 주세요.'); setIsError(true) }
  }
  const lockedMessage = configured ? '관리자 로그인 후 학습 자료를 추가할 수 있어요.' : '배포 설정에서 관리자 비밀번호를 등록하면 자료를 추가할 수 있어요.'
  return <section id="word-importer" className="importer" aria-labelledby="import-title"><div><p className="eyebrow">{canEdit ? '관리자 단어장' : '학습 자료'}</p><h2 id="import-title">선택한 과에 단어 추가</h2><p className="hint">CSV: <code>헬라어, 발음, 품사, 뜻</code> 형식으로 한 줄에 하나씩 입력하거나 JSON 배열을 붙여 넣으세요.</p></div>{canEdit ? <><textarea value={text} onChange={e => setText(e.target.value)} placeholder={'예) γράφω, 그라포, 동사, 쓰다\n\n또는 [{"greek":"γράφω","pronunciation":"그라포","part_of_speech":"동사","meaning":"쓰다"}]'} /><div className="import-footer"><p className={isError ? 'message error' : 'message'} aria-live="polite">{message}</p><button className="primary-btn" onClick={submit}>단어장 추가</button></div></> : <div className="editor-locked"><strong>🔒 편집 권한이 잠겨 있어요</strong><p>{lockedMessage}</p></div>}</section>
}
