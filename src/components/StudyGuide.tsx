export default function StudyGuide() {
  return (
    <section className="study-guide" aria-labelledby="guide-title">
      <div className="guide-heading">
        <div>
          <p className="eyebrow">처음 시작하기</p>
          <h2 id="guide-title">이렇게 학습해 보세요</h2>
        </div>
        <span aria-hidden="true">✦</span>
      </div>
      <ol>
        <li><b>1. 과를 고르세요</b><span>상단에서 학습할 단원을 선택합니다.</span></li>
        <li><b>2. 카드를 넘겨 보세요</b><span>헬라어 단어 카드를 누르면 뜻과 문법 정보를 볼 수 있어요.</span></li>
        <li><b>3. 퀴즈로 확인하세요</b><span>객관식 또는 주관식으로 익힌 단어를 점검합니다.</span></li>
        <li><b>4. 오답을 다시 복습하세요</b><span>틀린 단어는 자동으로 오답 노트에 모입니다.</span></li>
      </ol>
      <p className="guide-note">새 단어가 있다면 암기 카드 화면 아래에서 단어장을 추가할 수 있어요.</p>
    </section>
  )
}
