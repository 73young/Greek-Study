import { useEffect } from 'react'

export default function DataConnectionGuide() {
  useEffect(() => {
    const prepareSession = async () => {
      try {
        await fetch(import.meta.env.BASE_URL + 'api/session', { method: 'POST', credentials: 'same-origin' })
      } catch {
        // 학습 기능 요청에서 다시 연결을 시도합니다.
      }
    }
    prepareSession()
  }, [])

  return (
    <section className="data-connection-guide" aria-labelledby="data-connection-title">
      <div className="connection-icon" aria-hidden="true">◌</div>
      <div className="connection-content">
        <div className="connection-heading">
          <div>
            <p className="eyebrow">데이터 및 공유 안내</p>
            <h2 id="data-connection-title">공유용 배포 준비 완료</h2>
          </div>
          <span className="connection-status">공개 배포 구조 적용</span>
        </div>
        <p>이 학습장은 공개 웹주소와 영구 저장소에 배포할 수 있도록 준비되어 있어요. 배포 주소를 공유하면 다른 사람도 같은 단어·변화형·문장 문제로 학습할 수 있습니다.</p>
        <div className="connection-details">
          <article>
            <strong>함께 쓰는 학습 자료</strong>
            <span>과별 단어, 변화형, 번역 문제와 단어장 입력으로 추가한 내용은 공개 학습장에 공통으로 저장됩니다.</span>
          </article>
          <article>
            <strong>개인별 학습 기록</strong>
            <span>카드 위치, 퀴즈 진행, 오답 노트는 각 접속자의 브라우저를 기준으로 분리해 저장됩니다. 회원가입은 필요하지 않아요.</span>
          </article>
        </div>
        <p className="connection-note">공개 주소는 아직 이 미리보기 화면에 자동으로 만들어지지 않아요. 배포가 완료된 뒤 생성되는 공개 주소를 공유해 주세요. 쿠키를 지우거나 다른 기기에서 접속하면 개인 학습 기록은 이어지지 않을 수 있습니다.</p>
      </div>
    </section>
  )
}
