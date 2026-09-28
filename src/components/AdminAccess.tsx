import { FormEvent, useEffect, useState } from 'react'
import { api } from '../lib/api'
type Props = { onStatusChange: (isAdmin: boolean, configured: boolean) => void; onOpenManager: () => void }
export default function AdminAccess({ onStatusChange, onOpenManager }: Props) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const loadStatus = async () => {
    try {
      const response = await api('admin/status')
      const data = await response.json() as { is_admin: boolean; configured: boolean }
      setIsAdmin(data.is_admin); setConfigured(data.configured); onStatusChange(data.is_admin, data.configured)
    } catch {
      setMessage('관리자 상태를 확인하지 못했어요.')
    } finally { setLoading(false) }
  }
  useEffect(() => { loadStatus() }, [])
  const login = async (event: FormEvent) => {
    event.preventDefault()
    if (!password.trim()) { setMessage('관리자 비밀번호를 입력해 주세요.'); return }
    try {
      const response = await api('admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || '로그인하지 못했어요.')
      setPassword(''); setMessage('관리자 편집 권한이 열렸어요.'); await loadStatus(); onOpenManager()
    } catch (error) { setMessage(error instanceof Error ? error.message : '로그인하지 못했어요.') }
  }
  const logout = async () => {
    await api('admin/logout', { method: 'POST' })
    setMessage('관리자 편집 권한을 종료했어요.')
    await loadStatus()
  }
  if (loading) return <section className="admin-access" aria-live="polite"><div><p className="eyebrow">관리자 편집</p><strong>편집 권한 상태를 확인하고 있어요.</strong><p>단어장을 추가하거나 관리 메뉴를 사용하려면 관리자 로그인이 필요합니다.</p></div></section>
  if (isAdmin) return <section className="admin-access active"><div><p className="eyebrow">관리자 편집</p><strong>자료 편집 권한이 활성화되어 있어요.</strong><p>과를 새로 만들고, 선택한 과의 단어를 추가·관리할 수 있습니다.</p></div><div className="admin-actions"><button className="primary-btn" onClick={onOpenManager}>과·단어 관리 열기</button><button className="clear-btn" onClick={logout}>관리자 종료</button></div>{message && <span role="status">{message}</span>}</section>
  return <section className="admin-access"><div><p className="eyebrow">관리자 편집</p><strong>학습 자료를 추가하려면 관리자 로그인이 필요해요.</strong><p>학습자 개인의 카드·퀴즈·오답 노트는 로그인 없이 그대로 사용할 수 있습니다.</p></div><form onSubmit={login}><label htmlFor="admin-password">관리자 비밀번호</label><div><input id="admin-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="관리자 비밀번호 입력" /><button className="primary-btn">편집 권한 열기</button></div></form>{message && <span role="status">{message}</span>}</section>
}
