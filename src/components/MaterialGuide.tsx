type Props = { onAddWords: () => void }
export default function MaterialGuide({ onAddWords }: Props) {
  const showAttachmentHelp = () => {
    window.alert('교재 파일은 이 학습장 화면에서 직접 올릴 수 없어요. 현재 대화창의 메시지 입력칸 주변에 있는 📎 또는 + 버튼으로 PDF·사진·문서를 첨부해 주세요. 첨부 버튼이 보이지 않으면 단어 목록을 아래 입력칸에 복사해 넣어도 됩니다.')
  }

  return (
    <section className="material-guide" aria-labelledby="material-guide-title">
      <div className="material-guide-icon" aria-hidden="true">▤</div>
      <div>
        <p className="eyebrow">교재 자료 반영</p>
        <h2 id="material-guide-title">교재를 학습 자료로 추가하는 방법</h2>
        <p>PDF, 사진, 문서 파일은 이 화면에서 직접 올릴 수 없어요. 아래 <b>교재 파일 첨부 안내</b>를 누르면 첨부 위치를 다시 확인할 수 있어요.</p>
        <div className="attachment-actions">
          <button className="attachment-help-button" onClick={showAttachmentHelp}>📎 교재 파일 첨부 안내</button>
          <span>대화창의 📎 또는 + 버튼으로 보내 주세요</span>
        </div>
        <p>단어 목록만 있다면 아래 입력란에 CSV 또는 JSON 형식으로 붙여 넣어 바로 추가할 수 있습니다.</p>
        <button className="material-guide-button" onClick={onAddWords}>단어 입력 영역으로 이동 ↓</button>
      </div>
    </section>
  )
}
