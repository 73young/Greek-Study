type Props = { onAddWords: () => void }
export default function MaterialGuide({ onAddWords }: Props) {
  return (
    <section className="material-guide" aria-labelledby="material-guide-title">
      <div className="material-guide-icon" aria-hidden="true">▤</div>
      <div>
        <p className="eyebrow">교재 자료 반영</p>
        <h2 id="material-guide-title">교재를 학습 자료로 추가하는 방법</h2>
        <p>현재 이 환경에서는 앱 안의 JPG·PDF 업로드 및 자동 읽기 기능을 제공하지 않으며, 대화창 파일 첨부도 사용할 수 없는 상태예요.</p>
        <div className="file-drop-area" role="note" aria-label="교재 파일 자동 반영 안내">
          <span className="file-drop-icon" aria-hidden="true">▤</span>
          <span><b>교재 파일 자동 반영은 사용할 수 없어요</b><em>교재의 단어 목록을 텍스트로 복사해 아래 입력란에 붙여 넣어 주세요</em></span>
        </div>
        <p className="file-upload-note">가장 가까운 방법은 PDF·JPG에서 단어를 복사하거나 직접 옮겨 <b>헬라어, 발음, 품사, 뜻</b> 순서의 CSV 또는 JSON으로 입력하는 것입니다.</p>
        <button className="material-guide-button" onClick={onAddWords}>단어 입력 영역으로 이동 ↓</button>
      </div>
    </section>
  )
}
