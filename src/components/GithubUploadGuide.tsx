import { useState } from 'react'
type Step = { number: string; title: string; text: string; command?: string }
const steps: Step[] = [
  { number: '1', title: 'GitHub 저장소 주소를 복사하세요', text: '만들어 둔 GitHub 저장소 페이지에서 초록색 Code 버튼을 누르고 HTTPS 주소를 복사하세요. 주소는 보통 github.com/내아이디/저장소이름.git 형태입니다.' },
  { number: '2', title: '프로젝트를 준비하세요', text: '이 학습장 프로젝트가 있는 작업 환경의 터미널을 열고, 아래 내용을 한 줄씩 실행하세요.' },
  { number: '3', title: '내 저장소 주소를 연결하세요', text: '아래 주소의 내아이디/저장소이름 부분만 실제 GitHub 저장소 정보로 바꿔 실행하세요.', command: 'git remote add origin https://github.com/내아이디/저장소이름.git' },
  { number: '4', title: '첫 업로드를 완료하세요', text: '아래 내용을 실행하면 현재 프로젝트 전체가 main 브랜치에 올라갑니다.', command: 'git add .\ngit commit -m "헬라어 단어 학습장 첫 배포"\ngit push -u origin main' },
]
export default function GithubUploadGuide() {
  const [copied, setCopied] = useState('')
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(`${label}을(를) 복사했어요.`)
    } catch {
      setCopied('복사하지 못했어요. 내용을 길게 눌러 직접 복사해 주세요.')
    }
  }
  return <section className="github-guide panel" aria-labelledby="github-guide-title">
    <div className="section-heading">
      <div><p className="eyebrow">공개 배포 준비</p><h2 id="github-guide-title">GitHub에 프로젝트 전체 올리기</h2></div>
      <span className="count-badge">약 5분</span>
    </div>
    <p className="github-intro">이미 GitHub 저장소를 만들었다면, 아래 순서대로 현재 학습장 전체를 올릴 수 있어요. 업로드가 끝나면 Render에서 이 저장소를 선택해 공개 배포를 진행하세요.</p>
    <div className="github-note">
      <strong>컴퓨터 터미널에서 실행하는 방법</strong>
      <span>프로젝트를 컴퓨터에 내려받아 압축을 푼 뒤, 해당 폴더를 엽니다. Windows에서는 폴더 빈 곳에서 마우스 오른쪽 버튼을 눌러 ‘터미널에서 열기’를 선택하고, Mac에서는 터미널 앱을 열어 프로젝트 폴더로 이동하세요. 그다음 아래 명령을 위에서부터 한 줄씩 실행하면 됩니다.</span>
    </div>
    <ol className="github-steps">
      {steps.map(step => <li key={step.number}>
        <span className="step-number" aria-hidden="true">{step.number}</span>
        <div><h3>{step.title}</h3><p>{step.text}</p>{step.command && <div className="command-box"><pre>{step.command}</pre><button onClick={() => copy(step.command!, step.number === '3' ? '저장소 연결 명령' : '업로드 명령')}>복사</button></div>}</div>
      </li>)}
    </ol>
    {copied && <p className="github-message" role="status">{copied}</p>}
    <div className="github-note"><strong>확인 방법</strong><span>GitHub 저장소 페이지를 새로고침했을 때 backend, src, Dockerfile, render.yaml 등이 보이면 업로드가 완료된 것입니다.</span></div>
    <p className="github-warning">관리자 비밀번호나 개인 인증 정보는 저장소 파일에 적지 마세요. 관리자 비밀번호는 배포 서비스의 환경 설정에서만 등록해 주세요.</p>
  </section>
}
