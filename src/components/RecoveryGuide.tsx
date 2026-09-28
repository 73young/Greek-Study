import { useState } from 'react'
type Deploy = {
  commit: string
  deployedAt: string
  duration: string
}
const deployments: Deploy[] = [
  { commit: '4088491', deployedAt: '8분 전 배포됨', duration: '39.4초' },
  { commit: '847b20f', deployedAt: '1시간 전 배포됨', duration: '22.9초' },
]
export default function RecoveryGuide() {
  const [selected, setSelected] = useState<Deploy | null>(null)
  const [copied, setCopied] = useState('')
  const copyCommit = async (commit: string) => {
    try {
      await navigator.clipboard.writeText(commit)
      setCopied(`커밋 식별자 ${commit}을 복사했어요.`)
    } catch {
      setCopied('복사하지 못했어요. 커밋 식별자를 직접 선택해 복사해 주세요.')
    }
  }
  return <section className="recovery-guide panel" aria-labelledby="recovery-title">
    <div className="section-heading">
      <div><p className="eyebrow">자료 복구 안내</p><h2 id="recovery-title">배포 기록에서 이전 버전 확인하기</h2></div>
      <span className="count-badge">2개 기록</span>
    </div>
    <p className="recovery-intro">아래는 제공해 주신 배포 기록이에요. <b>롤백은 코드 버전을 되돌리는 기능</b>이며, 입력한 단어 자료는 연결된 영구 저장소 또는 그 스냅샷에 남아 있어야 복구할 수 있습니다.</p>
    <div className="recovery-warning" role="note"><strong>현재 코드만으로는 사라진 자료가 복구되지 않아요</strong><span>지금 코드를 다시 배포하거나 이전 배포로 롤백해도, 이미 비어 있는 단어·과·변화형 자료가 자동으로 돌아오지는 않습니다. 자료를 되살리려면 자료가 있던 기존 영구 디스크를 다시 연결하거나, 자료가 사라지기 전의 디스크 스냅샷을 복원해야 합니다.</span></div>
    <div className="deploy-list" aria-label="배포 기록">
      {deployments.map((deploy, index) => <article className="deploy-record" key={deploy.commit}>
        <div className="deploy-status"><span className="status-dot" aria-hidden="true" /><div><strong>배포됨</strong><span>{deploy.deployedAt}</span></div></div>
        <dl>
          <div><dt>배포 방식</dt><dd>파일 업로드</dd></div>
          <div><dt>실행 방식</dt><dd>자동 배포</dd></div>
          <div><dt>지속 시간</dt><dd>{deploy.duration}</dd></div>
          <div><dt>커밋 식별자</dt><dd><code>{deploy.commit}</code></dd></div>
        </dl>
        <div className="deploy-actions"><button className="outline-btn" onClick={() => copyCommit(deploy.commit)}>식별자 복사</button>{index === 1 && <button className="primary-btn" onClick={() => setSelected(deploy)}>이 버전으로 롤백 안내</button>}</div>
      </article>)}
    </div>
    {copied && <p className="recovery-message" role="status">{copied}</p>}
    {selected && <section className="rollback-steps" aria-live="polite"><h3><code>{selected.commit}</code> 버전으로 되돌리는 순서</h3><ol><li>배포 서비스의 현재 앱 화면에서 <b>Deploys</b> 목록을 엽니다.</li><li><b>{selected.commit}</b> 기록을 찾아 <b>Rollback</b>을 선택합니다.</li><li>완료된 뒤 영구 저장소 연결 경로와 <code>DB_PATH=/data/app.db</code> 설정을 확인합니다.</li><li>자료가 보이지 않으면 디스크의 사라지기 전 스냅샷을 찾아 복원합니다.</li></ol><p>이 화면에서는 외부 배포 서비스에 직접 접속하거나 롤백을 실행할 수 없어요. 대신 현재 기록을 기준으로 안전한 복구 순서를 안내합니다.</p></section>}
    <div className="recovery-warning"><strong>먼저 확인하세요</strong><span>새 배포를 계속하기 전 자동 배포를 잠시 멈추고, 기존 서비스의 영구 디스크와 스냅샷을 삭제하지 마세요.</span></div>
  </section>
}
