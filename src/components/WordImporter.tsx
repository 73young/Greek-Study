import { useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Word } from '../types'
type Props = { lessonId: number; onAdded: () => void; canEdit: boolean; configured: boolean }
type Parsed = Omit<Word, 'id' | 'lesson_id'>
const invisibleMarks = /[\u200B-\u200D\u2060\uFEFF]/g
const clean = (value: string) => value.normalize('NFC').replace(invisibleMarks, '').replace(/\u00A0/g, ' ').trim()
const separators = /[\t,;|]/
function parseWords(text: string): Parsed[] {
  const trimmed = clean(text)
  if (!trimmed) throw new Error('단어장 내용을 붙여 넣어 주세요.')
  if (trimmed.startsWith('[')) {
    const data: unknown = JSON.parse(trimmed)
    if (!Array.isArray(data)) throw new Error('JSON은 단어 목록 배열이어야 합니다.')
    return data.map((item, i) => {
      const row = item as Record<string, unknown>
      return validate({ greek: clean(String(row.greek || '')), pronunciation: clean(String(row.pronunciation || '')), part_of_speech: clean(String(row.part_of_speech || row.partOfSpeech || '')), meaning: clean(String(row.meaning || '')) }, i + 1)
    })
  }
  return trimmed.split(/\r?\n/).filter(line => clean(line)).map((line, i) => {
    const values = line.split(separators).map(clean)
    if (values.length !== 4) throw new Error(`${i + 1}번째 줄은 쉼표·탭·세미콜론 중 하나로 구분한 4개 항목이어야 합니다.`)
    return validate({ greek: values[0], pronunciation: values[1], part_of_speech: values[2], meaning: values[3] }, i + 1)
  })
}
function validate(word: Parsed, line: number) {
  if (!word.greek || !word.pronunciation || !word.part_of_speech || !word.meaning) throw new Error(`${line}번째 단어의 필수 항목이 비어 있어요.`)
  if (!/[\u0370-\u03FF\u1F00-\u1FFF]/.test(word.greek)) throw new Error(`${line}번째 줄의 첫 항목에서 헬라어 글자를 찾지 못했어요.`)
  return word
}
export default function WordImporter({ lessonId, onAdded, canEdit, configured }: Props) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [checked, setChecked] = useState(false)
  const parsed = useMemo(() => {
    try { return { words: text.trim() ? parseWords(text) : [], error: '' } }
    catch (error) { return { words: [], error: error instanceof Error ? error.message : '입력 형식을 확인해 주세요.' } }
  }, [text])
  const checkInput = () => {
    setChecked(true)
    setMessage(parsed.error || (parsed.words.length ? `${parsed.words.length}개 헬라어 단어를 정상적으로 인식했어요.` : '붙여 넣은 내용이 없어요.'))
    setIsError(Boolean(parsed.error) || !parsed.words.length)
  }
  const submit = async () => {
    try {
      const words = parseWords(text)
      const res = await api(`lessons/${lessonId}/words`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '저장하지 못했어요.')
      setMessage(`${data.added}개 단어를 추가했어요. 같은 헬라어 표기는 건너뛰었어요.`); setIsError(false); setChecked(false); setText(''); onAdded()
    } catch (error) { setMessage(error instanceof Error ? error.message : '형식을 다시 확인해 주세요.'); setIsError(true) }
  }
  const lockedMessage = configured ? '관리자 로그인 후 이 단어장을 저장할 수 있어요.' : '관리자 비밀번호를 설정하면 이 단어장을 저장할 수 있어요.'
  return <section id="word-importer" className="importer" aria-labelledby="import-title"><div><p className="eyebrow">헬라어 붙여넣기</p><h2 id="import-title">헬라어 단어 인식 · 추가</h2><p className="hint">여기에 복사한 헬라어를 붙여 넣고 먼저 <b>인식 확인</b>을 눌러 보세요. 쉼표, 탭, 세미콜론 중 하나로 <code>헬라어 · 발음 · 품사 · 뜻</code>을 구분해 한 줄에 하나씩 입력합니다.</p></div><textarea lang="el" spellCheck={false} value={text} onChange={e => { setText(e.target.value); setChecked(false); setMessage(''); setIsError(false) }} placeholder={'예) γράφω, 그라포, 동사, 쓰다\n또는 γράφω\t그라포\t동사\t쓰다\n\n또는 [{"greek":"γράφω","pronunciation":"그라포","part_of_speech":"동사","meaning":"쓰다"}]'} /><div className={`paste-preview ${checked && isError ? 'has-error' : ''}`} aria-live="polite">{text.trim() ? (parsed.words.length ? <><b>인식된 단어 {parsed.words.length}개</b><span>{parsed.words.slice(0, 3).map(word => word.greek).join(' · ')}{parsed.words.length > 3 ? ' · …' : ''}</span></> : <span>{checked ? parsed.error : '인식 확인 버튼을 누르면 결과가 표시됩니다.'}</span>) : <span>헬라어를 붙여 넣으면 여기에서 인식 결과를 확인할 수 있어요.</span>}</div><div className="import-footer"><p className={isError ? 'message error' : 'message'} aria-live="polite">{message}</p><div className="import-actions"><button className="outline-btn" type="button" onClick={checkInput}>인식 확인</button>{canEdit ? <button className="primary-btn" onClick={submit}>선택한 과에 추가</button> : <span className="save-lock-note">🔒 {lockedMessage}</span>}</div></div></section>
}
